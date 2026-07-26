# Warden Helm Chart

End-to-end Kubernetes deployment for Techanv Warden:

| Component | Image | Description |
|-----------|--------|-------------|
| **API** | `ghcr.io/sussec/warden` | ASP.NET Core API + scan job runner |
| **Web** | `ghcr.io/sussec/warden-web` | Next.js UI (proxies `/api` and `/ws` to the API) |
| **OSV** | `ghcr.io/sussec/warden-osv` | OSV.dev advisory enrichment |
| **PostgreSQL** | `pgvector/pgvector:pg18` | Primary DB with vector support |

Aligned with `docker-compose.yml` service names so stock images work without rebuild:
- API Service DNS: **`warden`** (`api.compatServiceName: true`)
- OSV Service DNS: **`osv-api`**

## Prerequisites

- Kubernetes 1.25+
- Helm 3.12+
- StorageClass for PVCs (or disable persistence)
- Optional: Ingress controller (nginx) + cert-manager for TLS

## Quick start

```bash
# From repo root
helm upgrade --install warden ./charts/warden \
  --namespace warden --create-namespace \
  --set secrets.systemPassword='YourStrongSystemPass!' \
  --set secrets.accessTokenKey="$(openssl rand -hex 16)" \
  --set secrets.refreshTokenKey="$(openssl rand -hex 16)" \
  --set secrets.postgresPassword="$(openssl rand -hex 16)"

# Port-forward UI
kubectl -n warden port-forward svc/warden-web 8080:3000
# open http://localhost:8080  →  system / YourStrongSystemPass!
```

Release name defaults the web service to `{release}-web`. With default release name `warden`, the service is `warden-web`.

## Production

```bash
helm upgrade --install warden ./charts/warden \
  --namespace warden --create-namespace \
  -f charts/warden/values-production.yaml \
  --set secrets.systemPassword='...' \
  --set secrets.accessTokenKey='...' \
  --set secrets.refreshTokenKey='...' \
  --set secrets.postgresPassword='...' \
  --set secrets.wardenToken='...' \
  --set api.env.frontendUrl='https://warden.example.com'
```

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `secrets.systemPassword` | `ChangeMe_L0cal!` | Login password for `system` user |
| `secrets.accessTokenKey` | auto | JWT signing key (pin on upgrades) |
| `secrets.refreshTokenKey` | auto | Refresh token key |
| `secrets.postgresPassword` | `warden` | DB password |
| `secrets.wardenToken` | `""` | CI token for UI scan runners |
| `secrets.existingSecret` | `""` | Use an existing Secret instead |
| `api.compatServiceName` | `true` | Create Service named `warden` for stock web images |
| `api.dockerSocket.enabled` | `false` | Mount host Docker socket (dev only) |
| `api.scanWorkspace.enabled` | `true` | PVC for git clones on UI scans |
| `postgresql.enabled` | `true` | Deploy pgvector PostgreSQL |
| `postgresql.external.host` | | External DB when `postgresql.enabled=false` |
| `osv.enabled` | `true` | OSV enrichment API |
| `ingress.enabled` | `false` | Expose web via Ingress |
| `apiIngress.enabled` | `false` | Expose API directly (OpenAPI/MCP) |

See [values.yaml](./values.yaml) for the full tree.

### External database

```yaml
postgresql:
  enabled: false
  external:
    host: my-pg.example.com
    port: 5432
    username: warden
    database: warden
secrets:
  postgresPassword: "..."
```

### Existing secret

```yaml
secrets:
  create: false
  existingSecret: warden-creds
```

Required keys:

- `system-password`
- `access-token-key`
- `refresh-token-key`
- `postgres-password`
- `warden-token`
- `scan-git-token` (may be empty)

## Architecture

```
                 ┌─────────────┐
  Browser ──────►│ Ingress/Web │  :3000
                 └──────┬──────┘
                        │ rewrite /api /ws
                 ┌──────▼──────┐     ┌──────────┐
                 │  API warden │────►│ Postgres │
                 └──────┬──────┘     │ pgvector │
                        │            └──────────┘
                 ┌──────▼──────┐
                 │   osv-api   │ ──► api.osv.dev
                 └─────────────┘
```

## UI-triggered scans on Kubernetes

The API’s Docker execution backend needs a Docker socket (compose default). On Kubernetes that is **off by default** (`api.dockerSocket.enabled=false`).

Options:

1. **CI pipelines** (recommended): run scanner images in GitHub Actions / GitLab with `WARDEN_TOKEN`.
2. **Dev only**: set `api.dockerSocket.enabled=true` on a node that has Docker (not production-safe).
3. **Future**: swap `IScanExecutionBackend` to Kubernetes Jobs (interface already abstracted).

## Validation

```bash
helm lint ./charts/warden
helm template warden ./charts/warden --debug | head
```

## Upgrade / uninstall

```bash
helm upgrade warden ./charts/warden -n warden -f my-values.yaml
helm uninstall warden -n warden
# PVCs are retained by default — delete manually if desired:
# kubectl -n warden delete pvc --all
```

## Images

Public/private GHCR images:

- `ghcr.io/sussec/warden:latest`
- `ghcr.io/sussec/warden-web:latest`
- `ghcr.io/sussec/warden-osv:latest`

If private, create a pull secret and set:

```yaml
global:
  imagePullSecrets:
    - name: ghcr-creds
```
