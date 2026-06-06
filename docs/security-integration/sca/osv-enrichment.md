# OSV Advisory Enrichment

Beyond ingesting scanner results, Warden can enrich findings and packages with **live advisory data from [OSV.dev](https://osv.dev)** — the distributed open-source vulnerability database aggregating GitHub Security Advisories, PyPA, RustSec, Go, and many more sources.

Enrichment is served by **`warden-osv`**, a small Go sidecar that ships with the compose stack. It caches advisories in-process, so the Warden API never hammers the public OSV API.

## What you get

- **Finding drill-down** — findings whose identity is an advisory id (`CVE-…`, `GHSA-…`, `OSV-…`, `PYSEC-…`, …) show a live *OSV advisory* panel: aliases, CVSS vector, severity, full details, affected packages with first fixed versions, and reference links. Always current — OSV records are re-fetched (with caching) rather than frozen at scan time.
- **Package drill-down** — the package drawer shows *Live OSV advisories* for the exact installed version, **including advisories published after your last scan**. A package can be flagged before any scanner re-runs.
- **Withdrawn detection** — advisories withdrawn upstream are marked, helping you close false alarms.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/finding/{findingId}/advisory` | Flattened OSV advisory for a finding (404 for non-advisory identities) |
| `GET /api/package/{packageId}/advisories` | Live advisories for a package version (empty when disabled) |

Both honor the standard session/permission model.

## Setup

The compose stack runs the sidecar by default:

```yaml
osv-api:
  image: ghcr.io/sussec/warden-osv:latest
```

and points the API at it via `OSV_SERVICE_URL` (set it empty to disable enrichment entirely).

### Restricted networks

`warden-osv` accepts `OSV_URL` to target an internal OSV-compatible mirror or proxy instead of `https://api.osv.dev`:

```yaml
osv-api:
  environment:
    OSV_URL: https://security.company.internal/osv
```

Cache freshness is tunable with `OSV_CACHE_TTL` (default `1h`).

## How it relates to the SCA scanners

[OSV-Scanner](osv.md), [CVE Lite CLI](cve-lite.md), Trivy, and Grype produce **point-in-time** findings during scans. Enrichment complements them: it answers "what does OSV say about this advisory/package *right now*?" — fresher fix versions, newly published advisories, withdrawals — without waiting for the next pipeline run.
