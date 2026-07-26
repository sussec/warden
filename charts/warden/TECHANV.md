# Techanv production (k3s + Cloudflare Tunnel)

Server: `160.191.163.5` (ops only — **do not use IP for apps/registry**)  
k3s: Ready · Traefik · local-path storage

## Public hostnames (Cloudflare Tunnel)

| Hostname | Tunnel service URL | Status |
|----------|-------------------|--------|
| https://harbor.techanv.com | `http://harbor.harbor.svc.cluster.local` | OK |
| https://warden-prod.techanv.com | `http://warden-web.warden.svc.cluster.local:3000` | OK |

DNS: Cloudflare nameservers (`mitch` / `tori.ns.cloudflare.com`), proxied A/CNAME → CF anycast.  
Cert: `*.techanv.com` (covers both hostnames).

### Do not expose via tunnel
- PostgreSQL, Redis, Harbor DB/trivy/jobservice internals

## Images (domain registry only)

```text
harbor.techanv.com/library/warden:latest
harbor.techanv.com/library/warden-web:latest
harbor.techanv.com/library/warden-osv:latest
harbor.techanv.com/library/warden-gitleaks:latest
```

Push:

```bash
docker login harbor.techanv.com -u admin
docker push harbor.techanv.com/library/warden:latest
```

## Helm

```bash
helm upgrade --install warden ./charts/warden -n warden --create-namespace \
  -f charts/warden/values-techanv.yaml \
  --set secrets.systemPassword='...' \
  --set secrets.accessTokenKey='...' \
  --set secrets.refreshTokenKey='...' \
  --set secrets.postgresPassword='...'
```

Defaults (domain-based):

```yaml
global:
  imageRegistry: harbor.techanv.com
  imageProject: library
api:
  env:
    frontendUrl: https://warden-prod.techanv.com
    scanImagePrefix: harbor.techanv.com/library/warden-
```

## Login

| App | URL | Credentials |
|-----|-----|-------------|
| Warden | https://warden-prod.techanv.com | `system` / see `/root/warden-deploy-secrets.env` on server |
| Harbor | https://harbor.techanv.com | `admin` / `Harbor12345` (**change me**) |

## E2E checks

```bash
# DNS → Cloudflare
dig +short warden-prod.techanv.com   # 104.21.x / 172.67.x

# HTTPS (no parklogic)
curl -sSI https://warden-prod.techanv.com/auth/login | head -5
curl -sSI https://harbor.techanv.com/ | head -5

# Login API via tunnel (web rewrites /api → API)
curl -sS -X POST https://warden-prod.techanv.com/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"system","password":"..."}'

# Harbor API
curl -sS -u admin:Harbor12345 https://harbor.techanv.com/api/v2.0/health
```

## ParkLogic / wrong page

If a browser shows `parklogicchannel.com/?d=techanv.com`, that is **ISP/DNS parking**, not Warden.
Fix: use Cloudflare DNS (`1.1.1.1`), clear cache, confirm CF DNS CNAME for `warden-prod` → tunnel (proxied).

## UI agent scans on k8s

## UI scanner fleet (all plugins)

On k3s there is **no Docker**. The API uses the **Kubernetes Job** backend (`scanBackend: kubernetes`) so gitleaks, semgrep, trivy, and the rest of the fleet run as Jobs.

1. Ensure `secrets.wardenToken` is a valid CI token from **Setting → Access Token**.
2. Create a Harbor pull secret (if images are private):
   ```bash
   kubectl -n warden create secret docker-registry harbor-pull \
     --docker-server=harbor.techanv.com \
     --docker-username=admin \
     --docker-password='…'
   ```
3. Build and push every scanner image:
   ```bash
   docker login harbor.techanv.com
   REGISTRY=harbor.techanv.com/library ./scripts/build-push-scanners.sh
   # or start with core tools:
   REGISTRY=harbor.techanv.com/library ./scripts/build-push-scanners.sh gitleaks semgrep trivy trufflehog
   ```
4. Helm sets `SCAN_IMAGE_PREFIX=harbor.techanv.com/library/warden-` and scan RBAC automatically.
5. In the UI: **Scanner → Fleet** → Run (git URL targets). Capability should show `backend: kubernetes` and all plugins enabled.

Docker socket is **off** by default on Kubernetes. Prefer K8s Jobs or CI scanners + `WARDEN_TOKEN`.  
Scanner images: `harbor.techanv.com/library/warden-gitleaks:latest` (and others as you push).
