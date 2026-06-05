# OWASP ZAP

[OWASP ZAP](https://www.zaproxy.org/) performs dynamic application security testing (DAST) against a **running** application — a baseline passive scan plus spidering. The `warden-zap` image wraps it for Techanv Warden.

## Local scan (Docker Compose)

Set `SCAN_TARGET_URL` to the running application; no source is mounted:

```bash
SCAN_TARGET_URL=https://staging.example.com docker compose --profile scan run --rm zap
```

Launch it from the UI on the **Scanner** page (the run dialog asks for a **target URL**) — see [Using Warden → Scanners](../../usage/scanners.md).

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- A reachable target. Only scan systems you are authorised to test.

!!! warning "Authorised testing only"
    DAST actively probes a live target. Run it exclusively against environments you own or have explicit permission to test.
