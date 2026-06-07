# cargo-deny

[cargo-deny](https://github.com/EmbarkStudios/cargo-deny) lints a Rust project across three axes in one tool: **security advisories** (RustSec), **OSS license policy** (allow/deny lists), and **banned/duplicate crates**. It closes the license-compliance gap that the vulnerability scanners do not cover. The `warden-cargo-deny` image wraps it — a **Rust-native** scanner using the same HTTP+JSON CI contract as the other scanners.

## Local scan

```bash
SCAN_TARGET=/path/to/rust-repo docker compose --profile scan run --rm cargo-deny
```

License policy lives in the project's `deny.toml`. **With** a `deny.toml` present the wrapper runs the full `cargo deny check` (honoring your allow/deny lists); **without** one it runs `advisories bans` only (a config-less license check flags every crate as "not allowed" — pure noise). Override with `CARGO_DENY_CHECKS` (e.g. `advisories`, `licenses bans`).

## Mapping

Each diagnostic becomes a finding. Advisory diagnostics use the **CVE alias** (else the `RUSTSEC-…` id) as identity so they dedup against [cargo-audit](cargo-audit.md) and the other SCA scanners; license/ban diagnostics key on the offending `crate@version`. Severity: `error` → High, `warning` → Medium. Category: advisory / license / banned.

## Requirements

- A CI token as `WARDEN_TOKEN`; a `Cargo.toml`/`Cargo.lock` in the repo.
- The image bundles the RustSec advisory-db; `cargo metadata` runs at scan time (the cargo driver is included).
