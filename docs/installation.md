# Installation

Techanv Warden ships as container images and is deployed with Docker Compose. A deployment consists of three services: the web application (`web`), the backend API (`warden`), and PostgreSQL (`db`).

## Requirements

- Docker Engine 24 or later with the Compose plugin
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

## Building from source

The repository contains everything required to build both images locally:

```bash
git clone https://github.com/sussec/warden.git
cd warden
cp .env.example .env   # then edit secrets
docker compose up -d --build
```
