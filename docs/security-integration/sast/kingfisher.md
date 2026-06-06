# Kingfisher

[Kingfisher](https://github.com/mongodb/kingfisher) is MongoDB's open-source **secret scanner** built in Rust. Its differentiator over [Gitleaks](gitleaks.md) and [TruffleHog](trufflehog.md) is **live validation**: for many providers it calls the real API to confirm whether a discovered credential is *still active*, slashing false positives. It ships 950+ detection rules. The `warden-kingfisher` image wraps it for Techanv Warden.

## Local scan (Docker Compose)

```bash
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm kingfisher
```

The wrapper runs Kingfisher with JSON output, maps each finding (rule, file, line, validation status) to a secret finding, and uploads them through the CI finding API. Launch it from the UI on the **Scanner** page — see [Using Warden → Scanners](../../usage/scanners.md).

## Severity: validated secrets are Critical

Kingfisher reports a validation status per finding. The wrapper maps:

- **Critical** — `Active Credential` (validation confirmed the secret is *live* — the worst case; rotate immediately).
- **High / Medium / Low** — otherwise, from Kingfisher's own confidence bucket.

So a confirmed-live AWS key floats to the top of triage above static pattern matches.

## Options

| Variable | Effect |
|---|---|
| `KINGFISHER_NO_VALIDATE` | `true` — pattern-match only; skip live validation against provider APIs (faster, no outbound calls, but no Active/Inactive status) |
| `KINGFISHER_ARGS` | Extra raw CLI args appended verbatim (e.g. `--confidence low`, `--no-validate`) |

> **Validation makes network calls.** With validation enabled (the default) Kingfisher contacts provider APIs to test discovered credentials. Use `KINGFISHER_NO_VALIDATE=true` in environments where that outbound traffic is undesirable.

## How it relates to the other secret scanners

[Gitleaks](gitleaks.md) and [TruffleHog](trufflehog.md) are fast pattern/entropy scanners; Kingfisher adds **live validation and revocation intelligence** on top. Run it alongside them — findings deduplicate per project — to prioritize *confirmed-exploitable* credentials first.

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- For validation: outbound access to the relevant provider APIs.
