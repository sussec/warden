# GuardDog

[GuardDog](https://github.com/DataDog/guarddog) (Datadog) inspects dependency manifests for **malicious-package** indicators — typosquatting, suspicious install scripts, obfuscated code, and data exfiltration. This is supply-chain *attack* detection, distinct from CVE-based SCA, which only finds known vulnerabilities in legitimate packages. The `warden-guarddog` image wraps it for Techanv Warden.

## Local scan (Docker Compose)

```bash
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm guarddog
```

GuardDog verifies the dependencies declared in supported manifests and reports any flagged package as a critical finding through the CI finding API. Supported manifests: `requirements.txt` (PyPI), `package.json` (npm), `go.mod` (Go).

Launch it from the UI on the **Scanner** page — see [Using Warden → Scanners](../../usage/scanners.md).

## Why this matters in 2026

Dependency-confusion and typosquatting attacks have grown sharply as AI assistants suggest package names that may not exist (and attackers pre-register them). CVE scanners cannot catch a package that is malicious-by-design; GuardDog's heuristics can.

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- Internet access to fetch and inspect the declared packages.
