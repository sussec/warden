# Checkov

[Checkov](https://www.checkov.io/) (Bridgecrew / Prisma Cloud) is an IaC static analyzer with a large, frequently-updated ruleset across Terraform, CloudFormation, Kubernetes, Helm, Dockerfile, ARM, Serverless, and GitHub Actions. It complements [Trivy IaC](trivy-iac.md) with broader and deeper coverage. The `warden-checkov` image wraps it for Techanv Warden.

## Local scan (Docker Compose)

```bash
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm checkov
```

Checkov reports each failed check as a finding with file and line, ingested through the CI finding API (`type: Sast`). In a merge request these findings are commented inline. Optional overrides: `SCAN_REPO_NAME`, `SCAN_BRANCH`, `SCAN_COMMIT`.

Launch it from the UI on the **Scanner** page — see [Using Warden → Scanners](../../usage/scanners.md).

## Checkov vs Trivy IaC

Run both for breadth — they use different rule engines and catch different misconfigurations. Warden deduplicates findings, so overlap merges cleanly.

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
