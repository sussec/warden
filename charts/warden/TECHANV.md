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

Docker socket is **off** by default. Prefer CI scanners + `WARDEN_TOKEN`.  
Scanner images: `harbor.techanv.com/library/warden-gitleaks:latest` (and others as you push).
