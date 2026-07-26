# Installation

Techanv Warden ships as container images and is deployed with **Docker Compose** or **Helm on Kubernetes**. A full deployment includes the web UI (`web`), backend API (`warden`), optional OSV enrichment (`osv-api`), and PostgreSQL with pgvector (`db`).

## Requirements

- Docker Engine 24 or later with the Compose plugin **or** Kubernetes 1.25+ with Helm 3.12+
- 2 vCPU / 4 GB RAM minimum for an evaluation deployment
- A PostgreSQL volume with regular backups for production use

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SYSTEM_PASSWORD` | yes | Password for the built-in `system` administrator account, applied on first start. If blank, a random password is generated and written to the application configuration. |
| `ACCESS_TOKEN_KEY` | yes | Signing key for JWT access tokens. Use a random secret of 32 or more characters. |
| `REFRESH_TOKEN_KEY` | yes | Signing key for JWT refresh tokens. Must differ from `ACCESS_TOKEN_KEY`. |
| `FRONTEND_URL` | yes | Public URL of the web application, for example `https://warden.example.com`. Used for the CORS allowlist and OpenID Connect redirects. Accepts a comma-separated list; the first entry is the redirect target. |
| `OPENAPI_ENABLED` | no | Serve the OpenAPI specification and API reference UI. Defaults to `true`. Set to `false` to disable in hardened deployments. |
| `DB_SERVER`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | yes | PostgreSQL connection settings. |
| `AI_ENDPOINT`, `AI_MODEL`, `WARDEN_AI_API_KEY` | no | OpenAI-compatible endpoint for AI-assisted triage and semantic search. Leave empty to disable AI features. |
| `TRUSTED_PROXIES` | no | Comma-separated IPs or CIDR blocks of reverse proxies whose forwarded headers should be trusted. |
| `WARDEN_TOKEN` | no | CI access token (**Setting → Access Token**) used by UI-triggered scans to ingest results. Required only for the [Scanner page](usage/scanners.md) run buttons. |
| `DOCKER_GID` | no | Group ID of the host Docker socket, granting the non-root API user access for UI-triggered scans. See [UI-triggered scans](#ui-triggered-scans). |

## Kubernetes (Helm)

An umbrella chart under [`charts/warden`](https://github.com/sussec/warden/tree/main/charts/warden) deploys API, web, OSV, and PostgreSQL (pgvector) end to end.

```bash
helm upgrade --install warden ./charts/warden \
  --namespace warden --create-namespace \
  --set secrets.systemPassword='YourStrongSystemPass!' \
  --set secrets.accessTokenKey="$(openssl rand -hex 16)" \
  --set secrets.refreshTokenKey="$(openssl rand -hex 16)" \
  --set secrets.postgresPassword="$(openssl rand -hex 16)"

kubectl -n warden port-forward svc/warden-web 8080:3000
# open http://localhost:8080 — user system / YourStrongSystemPass!
```

Production example with Ingress:

```bash
helm upgrade --install warden ./charts/warden \
  --namespace warden --create-namespace \
  -f charts/warden/values-production.yaml \
  --set secrets.systemPassword='...' \
  --set secrets.accessTokenKey='...' \
  --set secrets.refreshTokenKey='...' \
  --set secrets.postgresPassword='...' \
  --set api.env.frontendUrl='https://warden.example.com'
```

Stock web images proxy the API at the Kubernetes Service named **`warden`** (compose-compatible). Full options: [charts/warden/README.md](https://github.com/sussec/warden/blob/main/charts/warden/README.md).

!!! note "UI-triggered scans on Kubernetes"
    Mounting the host Docker socket is off by default. Prefer CI scanner pipelines with `WARDEN_TOKEN`. See the chart README for `api.dockerSocket` (dev only) and the planned K8s Job backend.

## Docker Compose

Create a `.env` file alongside `docker-compose.yml`:

```bash
POSTGRES_USER=warden
POSTGRES_PASSWORD=change-me
POSTGRES_DB=warden
SYSTEM_PASSWORD=change-me
ACCESS_TOKEN_KEY=generate-a-random-32-char-secret
REFRESH_TOKEN_KEY=generate-a-different-32-char-secret
FRONTEND_URL=http://localhost:8080
OPENAPI_ENABLED=true
```

Create `docker-compose.yml`:

```yaml
services:
  web:
    image: ghcr.io/sussec/warden-web:latest
    depends_on:
      - warden
    environment:
      API_INTERNAL_URL: http://warden:8080
    ports:
      - "8080:3000" # single entry point for users

  warden:
    image: ghcr.io/sussec/warden:latest
    depends_on:
      - db
    environment:
      DB_SERVER: db
      DB_USERNAME: ${POSTGRES_USER}
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_NAME: ${POSTGRES_DB}
      SYSTEM_PASSWORD: ${SYSTEM_PASSWORD}
      ACCESS_TOKEN_KEY: ${ACCESS_TOKEN_KEY}
      REFRESH_TOKEN_KEY: ${REFRESH_TOKEN_KEY}
      FRONTEND_URL: ${FRONTEND_URL}
      OPENAPI_ENABLED: ${OPENAPI_ENABLED:-true}

  db:
    image: pgvector/pgvector:pg18
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      PGDATA: /data/postgres
    volumes:
      - warden_db:/data/postgres
    restart: unless-stopped

volumes:
  warden_db:
```

Start the stack:

```bash
docker compose up -d
```

Open `http://localhost:8080` and sign in with the username `system` and the password set in `SYSTEM_PASSWORD`.

## Notes

- The web service proxies all API traffic same-origin, so no CORS configuration is required for standard deployments. Sessions are delivered as httpOnly cookies.
- The backend API can additionally be exposed directly (for example on an internal port) for CI access tokens, the MCP endpoint at `/mcp`, and OpenAPI tooling at `/openapi/v1.json`.
- For production, terminate TLS at a reverse proxy in front of the `web` service and set `FRONTEND_URL` to the public HTTPS URL. List the proxy in `TRUSTED_PROXIES`.

## UI-triggered scans

Warden can launch the bundled scanner images on demand from the **Scanner** page (see [Using Warden → Scanners](usage/scanners.md)). The API container does this by talking to the host Docker daemon and starting each scanner as a **sibling container** (docker-out-of-docker) — no Docker-in-Docker, no `--privileged`.

To enable it, mount the Docker socket into the `warden` service and grant the non-root app user the socket's group:

```yaml
  warden:
    # ...
    environment:
      # ...
      WARDEN_TOKEN: ${WARDEN_TOKEN:-}
      SCAN_IMAGE_PREFIX: ${SCAN_IMAGE_PREFIX:-warden-}
      SCAN_NETWORK: ${SCAN_NETWORK:-warden_default}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    group_add:
      - "${DOCKER_GID:-957}"
```

Find the socket's group id and set it in `.env`:

```bash
echo "DOCKER_GID=$(stat -c %g /var/run/docker.sock)" >> .env
```

Build the scanner images so the runner can launch them by name:

```bash
docker compose --profile scan build
```

!!! note "Security & opt-out"
    Access to the Docker socket is root-equivalent on the host. This is appropriate for local-first and trusted single-tenant deployments. To disable UI scans entirely, omit the socket mount — the runner detects the missing socket and stays idle (the CLI `--profile scan` commands keep working). The dialog's **Run** buttons will report an error when the socket is absent.

## Building from source

The repository contains everything required to build both images locally:

```bash
git clone https://github.com/sussec/warden.git
cd warden
cp .env.example .env   # then edit secrets
docker compose up -d --build
```

## Container image reference

Two images are produced from the repository; both are built automatically by `docker compose up -d --build`.

### warden (API) — root `Dockerfile`

| Stage | Purpose |
|---|---|
| `base` | `mcr.microsoft.com/dotnet/aspnet:10.0`, non-root user, exposes 8080/8081 |
| `build_api_deps` | restores NuGet packages from `warden-api.csproj` (cached layer) |
| `build_api` / `publish_api` | builds and publishes the API in `Release` configuration |
| `final` | runtime image, entrypoint `dotnet warden-api.dll` |

The API image is backend-only: it serves `/api/*`, `/openapi/v1.json`, `/mcp`, and `/healthz`.

### warden-web — `warden-web/Dockerfile`

| Stage | Purpose |
|---|---|
| `deps` | `oven/bun:1`, installs dependencies with `bun install --frozen-lockfile` |
| `build` | `bun run build` producing the Next.js standalone output |
| `runtime` | `oven/bun:1-slim` running `bun server.js` on port 3000 |

Build argument:

| Argument | Default | Description |
|---|---|---|
| `API_INTERNAL_URL` | `http://warden:8080` | Baked into the Next.js proxy rewrites at build time. Set it to the API service URL reachable from the web container; the compose file passes it automatically. |

### Service wiring

| Service | Port mapping | Role |
|---|---|---|
| `web` | `8080:3000` | User entry point; proxies `/api`, `/openapi`, `/mcp`, `/healthz` to the API same-origin |
| `warden` | `5272:8080` | Direct API access for CI tokens, MCP clients, and `bun run gen-api` |
| `db` | `54321:5432` | PostgreSQL with pgvector |

Integrations (Jira, Redmine, Microsoft Teams, Mail) require no container or environment configuration: they are stored in the database and managed in the UI under **Setting > Integration** and per project under **Project > Setting > Integration**. The only related environment variables are the optional AI settings (`AI_ENDPOINT`, `AI_MODEL`, `WARDEN_AI_API_KEY`), which seed the AI configuration; SMTP for outbound mail is configured in the UI under **Setting > General**.
