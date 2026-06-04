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

### Available scanners

| Scanner | Type | Scans | Compose service |
|---|---|---|---|
| Semgrep | SAST | source code | semgrep |
| Trivy IaC | SAST (misconfig) | Terraform, K8s, Dockerfile | trivy-iac |
| Gitleaks | Secret | working tree | gitleaks |
| TruffleHog | Secret | filesystem / history | trufflehog |
| Trivy | SCA | dependencies | trivy |
| Grype | SCA | dependencies | grype |
| Trivy Image | Container | container images (set SCAN_IMAGE_REF) | trivy-image |
| OWASP ZAP | DAST | running URL (set SCAN_TARGET_URL) | zap |
| Nuclei | DAST | running URL (set SCAN_TARGET_URL) | nuclei |

Examples:

```bash
# code / dependency / secret / IaC — mount the repo
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm grype
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm trufflehog
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm trivy-iac

# container image
SCAN_IMAGE_REF=myorg/app:1.2.3 docker compose --profile scan run --rm trivy-image

# dynamic scan of a running app
SCAN_TARGET_URL=https://staging.example.com docker compose --profile scan run --rm zap
SCAN_TARGET_URL=https://staging.example.com docker compose --profile scan run --rm nuclei
```

## SARIF import

Any tool that emits SARIF 2.1.0 (CodeQL, Bandit, gosec, Checkov, and dozens more) can push findings without a wrapper:

```
POST /api/ci/sarif
CI-TOKEN: <token>
{
  "scan": { "source": "Local", "repoId": "my-repo", "repoUrl": "https://local/my-repo",
             "gitAction": "CommitBranch", "scanTitle": "CodeQL", "commitBranch": "main",
             "commitHash": "<sha>", "scanner": "codeql", "type": "Sast", "isDefault": true },
  "sarif": { "version": "2.1.0", "runs": [ ... ] }
}
```

Severity uses the SARIF `security-severity` property when present (>=9 Critical, >=7 High, >=4 Medium, >0 Low), otherwise the result level. Findings flow through the same dedup and lifecycle as native scanners.
