# Warden Helm Chart (production-ready)

End-to-end Kubernetes deployment matching **docker-compose** core services:

| Compose service | Chart component | Default image (domain) |
|-----------------|-----------------|------------------------|
| `web` | Deployment + Service `*-web` | `harbor.techanv.com/library/warden-web` |
| `warden` | Deployment + Service **`warden`** | `harbor.techanv.com/library/warden` |
| `osv-api` | Deployment + Service **`osv-api`** | `harbor.techanv.com/library/warden-osv` |
| `db` | StatefulSet + PVC | `docker.io/pgvector/pgvector:pg18` |

Registry is **domain-based** (no IP):

```yaml
global:
  imageRegistry: harbor.techanv.com
  imageProject: library
api:
  image:
    repository: warden   # → harbor.techanv.com/library/warden:latest
```

Techanv cluster file: `values-techanv.yaml`. Optional compose profiles (`llama`, `vllm`, scanners) stay outside the chart.

## Production features

- Non-root containers, `seccomp` RuntimeDefault, drop ALL capabilities
- Init container waits for PostgreSQL before API start
- Rolling updates (`maxUnavailable: 0`)
- Optional **HPA**, **PDB**, **NetworkPolicy**, **ServiceMonitor**
- Soft pod anti-affinity for multi-replica components
- Secrets with upgrade-safe key retention (`lookup`)
- External PostgreSQL support
- Ingress + optional raw API ingress (OpenAPI / MCP)
- `values-production.yaml` defaults for HA-ish deploy

## Install (dev / eval)

```bash
helm upgrade --install warden ./charts/warden \
  --namespace warden --create-namespace \
  --set secrets.systemPassword='YourStrongSystemPass!' \
  --set secrets.accessTokenKey="$(openssl rand -hex 16)" \
  --set secrets.refreshTokenKey="$(openssl rand -hex 16)" \
  --set secrets.postgresPassword="$(openssl rand -hex 16)"

kubectl -n warden port-forward svc/warden-web 8080:3000
# http://localhost:8080 → system / YourStrongSystemPass!
```

## Install (production)

```bash
helm upgrade --install warden ./charts/warden \
  --namespace warden --create-namespace \
  -f charts/warden/values-production.yaml \
  --set secrets.systemPassword='...' \
  --set secrets.accessTokenKey='...' \
  --set secrets.refreshTokenKey='...' \
  --set secrets.postgresPassword='...' \
  --set secrets.wardenToken='...' \
  --set api.env.frontendUrl='https://warden.example.com' \
  --set ingress.hosts[0].host=warden.example.com \
  --set ingress.tls[0].hosts[0]=warden.example.com \
  --set ingress.tls[0].secretName=warden-tls
```

## Compose → Helm env map

| Compose env | Helm value / secret key |
|-------------|-------------------------|
| `DB_SERVER` | auto → `*-postgresql` or `postgresql.external.host` |
| `DB_USERNAME` / `DB_NAME` | `postgresql.auth.*` |
| `DB_PASSWORD` | `secrets.postgresPassword` |
| `SYSTEM_PASSWORD` | `secrets.systemPassword` |
| `ACCESS_TOKEN_KEY` | `secrets.accessTokenKey` |
| `REFRESH_TOKEN_KEY` | `secrets.refreshTokenKey` |
| `FRONTEND_URL` | `api.env.frontendUrl` |
| `OPENAPI_ENABLED` | `api.env.openApiEnabled` |
| `TRUSTED_PROXIES` | `api.env.trustedProxies` |
| `AI_ENDPOINT` / `AI_MODEL` / `WARDEN_AI_API_KEY` | `api.env.*` |
| `WARDEN_TOKEN` | `secrets.wardenToken` |
| `SCAN_IMAGE_PREFIX` | `api.env.scanImagePrefix` |
| `SCAN_GIT_TOKEN` | `secrets.scanGitToken` |
| `OSV_SERVICE_URL` | auto `http://osv-api:9000` when `osv.enabled` |
| `API_INTERNAL_URL` (web) | `web.apiInternalUrl` (build-time on stock images: `http://warden:8080`) |

## Configuration highlights

| Key | Default | Notes |
|-----|---------|--------|
| `api.compatServiceName` | `true` | Service named `warden` for stock web images |
| `api.dockerSocket.enabled` | `false` | Host docker.sock — **dev only** |
| `networkPolicy.enabled` | `false` / prod `true` | Namespace isolation |
| `api.autoscaling.enabled` | `false` / prod `true` | HPA |
| `postgresql.enabled` | `true` | Set `false` + external host for managed DB |
| `secrets.existingSecret` | `""` | Use SealedSecrets / ExternalSecrets |

Full tree: [values.yaml](./values.yaml).

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

Required keys: `system-password`, `access-token-key`, `refresh-token-key`, `postgres-password`, `warden-token`, `scan-git-token`.

## Architecture

```
Browser ──► Ingress ──► web (:3000)
                           │ rewrite /api /ws
                           ▼
                        warden (:8080) ──► postgresql (pgvector)
                           │
                           └──► osv-api (:9000) ──► api.osv.dev
```

## UI-triggered scans on Kubernetes

Compose mounts the host Docker socket. On Kubernetes that is **off by default**.

| Approach | When |
|----------|------|
| CI scanners + `WARDEN_TOKEN` | **Recommended production** |
| `api.dockerSocket.enabled=true` | Trusted single-node / lab only |
| Future K8s Job backend | `IScanExecutionBackend` already abstracted in the API |

## Validate

```bash
helm lint ./charts/warden
helm template warden ./charts/warden \
  --set secrets.accessTokenKey=pin-this \
  --set secrets.refreshTokenKey=pin-this-too \
  -f charts/warden/values-production.yaml >/dev/null
```

## Uninstall

```bash
helm uninstall warden -n warden
# PVCs retained — delete if desired:
# kubectl -n warden delete pvc --all
```
