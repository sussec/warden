# Trivy IaC

[Trivy](https://github.com/aquasecurity/trivy) also scans infrastructure-as-code for misconfigurations — Terraform, Kubernetes manifests, and Dockerfiles. The `warden-trivy-iac` image wraps this mode and reports findings as SAST.

## Local scan (Docker Compose)

```bash
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm trivy-iac
```

Findings are ingested through the CI API with `type: Sast`. Optional overrides: `SCAN_REPO_NAME`, `SCAN_BRANCH`, `SCAN_COMMIT`.

Launch it from the UI on the **Scanner** page — see [Using Warden → Scanners](../../usage/scanners.md).

## What it catches

- Terraform: insecure resource settings, open security groups, unencrypted storage
- Kubernetes: privileged pods, missing resource limits, host mounts
- Dockerfile: running as root, unpinned base images, exposed secrets

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
