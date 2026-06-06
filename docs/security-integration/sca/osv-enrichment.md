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

## Exploit intelligence: EPSS + CISA KEV

`warden-osv` layers two exploit signals onto every advisory it serves, so triage can rank by *real-world risk* instead of CVSS alone:

- **EPSS** ([FIRST.org](https://www.first.org/epss/)) — probability the CVE is exploited in the wild within 30 days, shown as a percentage badge on the finding advisory panel and package drawer.
- **CISA KEV** ([Known Exploited Vulnerabilities](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)) — a red **KEV** badge (plus a *Ransomware* variant) means active exploitation has been observed; the finding panel adds a prioritize-remediation call-out.

GHSA/OSV ids resolve to their CVE alias automatically. Enrichment is best-effort: an EPSS or KEV outage degrades gracefully and never breaks advisory serving.

| Variable | Default | Purpose |
|---|---|---|
| `EPSS_URL` | `https://api.first.org/data/v1/epss` | EPSS API (point at an internal mirror if needed) |
| `KEV_URL` | CISA feed URL | KEV catalog JSON (the CISA CDN blocks some automated networks — point at the [`cisagov/kev-data`](https://github.com/cisagov/kev-data) mirror or an internal copy if refresh fails) |
| `KEV_REFRESH` | `6h` | KEV catalog background refresh interval |
| `ENRICH` | `true` | Set `false` to disable EPSS/KEV entirely |

## VEX export

`GET /api/project/{projectId}/vex` downloads the project's triage decisions as an [OpenVEX v0.2.0](https://github.com/openvex/spec) document: false positives become `not_affected`, accepted risks `affected`, fixed findings `fixed`. Feed it to Grype (`--vex`), Trivy, or osv-scanner so CI stops re-reporting advisories your team has already assessed.

## How it relates to the SCA scanners

[OSV-Scanner](osv.md), [CVE Lite CLI](cve-lite.md), Trivy, and Grype produce **point-in-time** findings during scans. Enrichment complements them: it answers "what does OSV say about this advisory/package *right now*?" — fresher fix versions, newly published advisories, withdrawals — without waiting for the next pipeline run.
