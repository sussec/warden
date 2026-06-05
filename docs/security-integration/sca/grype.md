# Grype

[Grype](https://github.com/anchore/grype) is a vulnerability scanner for dependencies, backed by [Syft](https://github.com/anchore/syft) for SBOM-grade dependency resolution. It serves as a second-opinion SCA alongside [Trivy](trivy.md). The `warden-grype` image wraps it for Techanv Warden.

## Local scan (Docker Compose)

```bash
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm grype
```

The scanner resolves dependencies, uploads packages and vulnerabilities through the CI dependency API, and marks the scan completed. Optional overrides: `SCAN_REPO_NAME`, `SCAN_BRANCH`, `SCAN_COMMIT`.

Launch it from the UI on the **Scanner** page — see [Using Warden → Scanners](../../usage/scanners.md).

## Trivy vs Grype

Both scan dependencies; running both widens coverage because they use different vulnerability databases and resolution strategies. Warden deduplicates packages, so overlapping results merge cleanly.

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
