# warden-osv

Techanv Warden's **OSV.dev advisory service** — a small Go sidecar exposing a
cached, typed facade over the public [OSV.dev](https://osv.dev) API. warden-api
uses it to enrich findings and packages with live advisory data (aliases, CVSS,
references, validated fix versions) without every API node hitting OSV.dev
directly.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz` | Liveness |
| `GET` | `/v1/vulns/{id}` | Raw OSV record (full schema) by id — CVE, GHSA, OSV, PYSEC, … |
| `GET` | `/v1/advisory/{id}` | Flattened advisory (id, aliases, severity bucket, CVSS vector, references, affected + first fixed version) |
| `GET` | `/v1/packages/{ecosystem}/{name}/{version}` | Flattened advisories affecting one package version |
| `POST` | `/v1/query` | OSV query passthrough (package version or commit) |
| `POST` | `/v1/querybatch` | OSV batch query passthrough (≤1000 queries) |

Single-advisory and package-version responses are cached in-process
(TTL + LRU), so repeated drill-downs are served without upstream calls.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `9000` | Listen port |
| `OSV_URL` | `https://api.osv.dev` | OSV-compatible endpoint (point at an internal mirror/proxy for restricted networks) |
| `CACHE_TTL` | `1h` | Advisory cache TTL (Go duration) |
| `CACHE_MAX` | `10000` | Max entries per cache |

## Run

```bash
# from the repo root (ships with docker compose)
docker compose up -d osv-api

# or standalone
cd warden-osv && go run ./cmd/warden-osv
```

warden-api consumes it via `OSV_SERVICE_URL` (default
`http://osv-api:9000` in compose; empty disables enrichment).

## Develop

```bash
go vet ./...
go test -race ./...
```

Stdlib-only — no third-party dependencies.
