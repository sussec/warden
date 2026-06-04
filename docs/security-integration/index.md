# Security Integration

Your application’s repository typically includes source code, dependency configurations. 
By performing repository scanning, vulnerabilities across these components can be identified.

We utilize open-source tools to integrate security scanning like: Semgrep, Gitleaks, Trivy. 
If you need to integrate another tool, feel free to create a request [here](https://github.com/sussec/warden/issues)

Security scanning tools include:

- **Static Application Security Testing (SAST)**: Examines the source code to uncover vulnerabilities.
- **Software Composition Analysis (SCA)**: Detects vulnerabilities in application dependencies and container images.


## Local scanning with Docker Compose

The repository ships ready-to-build scanner images under `scanners/`, wired into `docker-compose.yml` behind the `scan` profile. They let you push results from a local checkout without a CI pipeline.

1. Create a CI access token under **Setting > Access Token** and put it in `.env`:

   ```bash
   WARDEN_TOKEN=<token>
   ```

2. Run a scanner against a checkout, pointing `SCAN_TARGET` at the repository to scan (defaults to the current directory):

   ```bash
   SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm semgrep
   SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm gitleaks
   SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm trivy
   ```

Each scanner creates a scan (`source: Local`), uploads findings or dependencies through the CI ingest API, and marks the scan completed. Optional overrides: `SCAN_REPO_NAME`, `SCAN_BRANCH`, `SCAN_COMMIT`, and `SEMGREP_RULES` (default `p/default`).

| Scanner | Type | Base image |
|---|---|---|
| `semgrep` | SAST | `semgrep/semgrep` |
| `gitleaks` | Secret detection | `ghcr.io/gitleaks/gitleaks` |
| `trivy` | SCA / dependencies | `aquasec/trivy` |

For pipeline integration (GitLab CI, GitHub Actions), the same containers run as CI jobs — see the per-scanner pages.
