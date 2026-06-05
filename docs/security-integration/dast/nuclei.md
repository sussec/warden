# Nuclei

[Nuclei](https://github.com/projectdiscovery/nuclei) runs template-based vulnerability checks against a **running** target. The `warden-nuclei` image wraps it for Techanv Warden as a DAST scanner.

## Local scan (Docker Compose)

Set `SCAN_TARGET_URL` to the running application; no source is mounted:

```bash
SCAN_TARGET_URL=https://staging.example.com docker compose --profile scan run --rm nuclei
```

Launch it from the UI on the **Scanner** page (the run dialog asks for a **target URL**) — see [Using Warden → Scanners](../../usage/scanners.md).

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- A reachable target. Only scan systems you are authorised to test.

!!! warning "Authorised testing only"
    Nuclei sends active probes based on its template set. Run it only against environments you own or are explicitly authorised to test.
