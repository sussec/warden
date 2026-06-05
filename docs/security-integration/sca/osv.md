# OSV-Scanner

[OSV-Scanner](https://github.com/google/osv-scanner) is Google's open-source scanner backed by the [OSV.dev](https://osv.dev) database — the broadest open advisory source, covering many ecosystems, transitive dependencies, and **malicious-package advisories** (supply-chain attacks). It complements [Trivy](trivy.md) and [Grype](grype.md) with wider ecosystem and supply-chain coverage. The `warden-osv` image wraps it for Techanv Warden.

## Local scan (Docker Compose)

```bash
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm osv
```

OSV-Scanner resolves dependencies from lockfiles and manifests, uploads packages and vulnerabilities through the CI dependency API, and marks the scan completed. Optional overrides: `SCAN_REPO_NAME`, `SCAN_BRANCH`, `SCAN_COMMIT`.

Launch it from the UI on the **Scanner** page — see [Using Warden → Scanners](../../usage/scanners.md).

## Why add it alongside Trivy and Grype

- **Ecosystem breadth** — OSV.dev aggregates advisories across npm, PyPI, Go, Maven, crates.io, RubyGems, NuGet, and more, plus Linux distro and Git-commit-level data.
- **Supply-chain** — includes malicious-package advisories (typosquatting, dependency-confusion), not just CVEs.
- **Authoritative IDs** — findings use canonical OSV/GHSA identifiers, deduplicated against the other SCA scanners.

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- Supported lockfiles in the repository (e.g. `package-lock.json`, `go.sum`, `poetry.lock`, `Cargo.lock`, `pom.xml`).
