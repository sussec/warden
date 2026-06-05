# TruffleHog

[TruffleHog](https://github.com/trufflesecurity/trufflehog) detects and verifies secrets across a repository's **git history**, complementing the working-tree scan that [Gitleaks](gitleaks.md) performs. The bundled `warden-trufflehog` image wraps it for Techanv Warden.

## Local scan (Docker Compose)

```bash
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm trufflehog
```

The scanner creates a scan (`source: Local`), uploads verified secret findings through the CI ingest API, and marks the scan completed. Optional overrides: `SCAN_REPO_NAME`, `SCAN_BRANCH`, `SCAN_COMMIT`.

You can also launch it from the **Scanner** page in the UI — see [Using Warden → Scanners](../../usage/scanners.md).

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- For history scans, clone with full depth (`fetch-depth: 0` in CI).

!!! tip "Gitleaks vs TruffleHog"
    Run both: Gitleaks is fast on the working tree, TruffleHog verifies live credentials across the whole history. Findings from each flow through the same dedup and lifecycle.
