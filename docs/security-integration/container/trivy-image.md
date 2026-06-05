# Trivy Image

[Trivy](https://github.com/aquasecurity/trivy) scans container images for OS-package and language-dependency vulnerabilities. The `warden-trivy-image` wrapper reports them to Techanv Warden as container findings.

## Local scan (Docker Compose)

Set `SCAN_IMAGE_REF` to any local or remote image reference — no source checkout is mounted:

```bash
SCAN_IMAGE_REF=nginx:1.27 docker compose --profile scan run --rm trivy-image
SCAN_IMAGE_REF=myorg/app:1.2.3 docker compose --profile scan run --rm trivy-image
```

Launch it from the UI on the **Scanner** page (the run dialog asks for an **image reference**) — see [Using Warden → Scanners](../../usage/scanners.md).

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- The target image must be pullable by the Docker daemon (or already present locally).
