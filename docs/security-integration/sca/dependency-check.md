# OWASP Dependency-Check

[OWASP Dependency-Check](https://github.com/dependency-check/DependencyCheck) is a mature **Software Composition Analysis (SCA)** tool. It identifies a project's dependencies and matches them to known vulnerabilities via **CPE/NVD** lookups, then reports the linked CVEs. The `warden-dependency-check` image wraps it for Techanv Warden and ingests results through the SCA dependency path.

## Local scan (Docker Compose)

```bash
NVD_API_KEY=your-key SCAN_TARGET=/path/to/repo \
  docker compose --profile scan run --rm dependency-check
```

The wrapper runs Dependency-Check with JSON output, flattens each `dependencies[].vulnerabilities[]` into Warden's package + vulnerability model (CVE id from `name`, severity from `severity`/CVSS), and uploads them. Launch it from the UI on the **Scanner** page — see [Using Warden → Scanners](../../usage/scanners.md).

## NVD API key — strongly recommended

Dependency-Check uses the **NVD API** for its vulnerability data. Without an API key the initial data download is *extremely* slow and prone to rate-limit `403`s. Request a free key at <https://nvd.nist.gov/developers/request-an-api-key> and pass it as `NVD_API_KEY`.

The NVD data cache is mounted as a persistent volume (`dependency_check_data`) so repeated scans don't re-download the whole NVD. In CI, cache that volume between runs.

## Options

| Variable | Effect |
|---|---|
| `NVD_API_KEY` | NVD API key — strongly recommended for usable update speed |
| `DEPENDENCY_CHECK_NOUPDATE` | `true` — skip the NVD/data auto-update and scan against the cached database (fast, but only as fresh as the last update) |
| `DEPENDENCY_CHECK_ARGS` | Extra raw CLI args appended verbatim (e.g. `--enableExperimental --disableYarnAudit`) |

## How it relates to the other SCA scanners

Dependency-Check matches via **CPE/NVD**, which catches vulnerabilities in binaries and bundled libraries that purl-based tools can miss — a useful second opinion alongside [Grype](grype.md), [OSV-Scanner](osv.md), [Trivy](trivy.md), and [CVE Lite CLI](cve-lite.md). Findings deduplicate against the others by CVE identity per project. Pair it with [OSV Enrichment](osv-enrichment.md) for live EPSS/KEV exploit context.

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- Outbound access to the NVD API (or a pre-synced data cache for offline runs).
