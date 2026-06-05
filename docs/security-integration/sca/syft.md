# Syft (SBOM)

[Syft](https://github.com/anchore/syft) generates a Software Bill of Materials — a complete inventory of every component in a project. SBOM generation is the #1 supply-chain compliance theme of 2026 (government and defense procurement increasingly mandate it). The `warden-syft` image wraps Syft for Techanv Warden.

## Local scan (Docker Compose)

```bash
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm syft
```

Syft resolves every package across all detected ecosystems and uploads the full inventory through the CI dependency API (packages only — no vulnerabilities). The result is a complete dependency inventory you can browse under **Dependency** and export.

Launch it from the UI on the **Scanner** page — see [Using Warden → Scanners](../../usage/scanners.md).

## SBOM vs vulnerability scanning

Syft answers *"what is in my software?"* — the inventory. Pair it with [Trivy](trivy.md), [Grype](grype.md), or [OSV-Scanner](osv.md), which answer *"which of those have known vulnerabilities?"*. A complete inventory is the prerequisite for supply-chain risk management and is the artifact auditors ask for.

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
