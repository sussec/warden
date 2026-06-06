# Nikto

[Nikto](https://github.com/sullo/nikto) is a long-standing open-source **web server scanner** (DAST). It probes a live HTTP(S) target for dangerous files and CGIs, outdated server software, server misconfigurations, and information-disclosure issues across thousands of checks. The `warden-nikto` image wraps Nikto 2.5.0 for Techanv Warden, mapping each reported item to a DAST finding.

## Local scan (Docker Compose)

Nikto scans a **URL**, not a checkout — set `SCAN_TARGET_URL` (same convention as ZAP/Nuclei):

```bash
SCAN_TARGET_URL=https://example.com docker compose --profile scan run --rm nikto
```

The wrapper runs Nikto with JSON output, maps each `vulnerabilities[]` entry to a finding (id, message, affected URL+method), and uploads them through the CI finding API. Launch it from the UI on the **Scanner** page — see [Using Warden → Scanners](../../usage/scanners.md).

## How findings are mapped

Nikto's JSON carries no severity field, so the wrapper buckets pragmatically:

- **Info** — pure header / information-disclosure checks (missing `X-Frame-Options`, `Content-Security-Policy`, HSTS, etc.).
- **High** — messages indicating injection, remote code execution, command execution, or shell exposure.
- **Medium** — everything else Nikto reports (it only surfaces actionable issues).

Warden triage can refine from there. Each finding's location is `METHOD url` so the same issue on different paths deduplicates independently.

## Options

| Variable | Effect |
|---|---|
| `SCAN_TARGET_URL` | **Required** — the target host/URL to scan |
| `NIKTO_TUNING` | Nikto `-Tuning` string to select/skip test classes (e.g. `x6` to skip the DoS tests) |
| `NIKTO_MAXTIME` | Maximum testing time per host (e.g. `600s`, `10m`) — bound long scans in CI |

## Notes

- Nikto is **noisy and active** — only point it at hosts you are authorized to test.
- It complements [Nuclei](nuclei.md) (template-based) and [OWASP ZAP](zap.md) (proxy/spider) rather than replacing them: Nikto's strength is its breadth of known-bad-path and server-fingerprint checks.

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- Network reachability from the scanner container to `TARGET_URL`.
