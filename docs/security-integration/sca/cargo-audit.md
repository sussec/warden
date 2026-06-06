# cargo-audit (RustSec)

[cargo-audit](https://github.com/rustsec/rustsec/tree/main/cargo-audit) is the official **RustSec** auditing tool for Rust/Cargo projects. It checks a project's `Cargo.lock` against the [RustSec advisory database](https://rustsec.org/) and reports vulnerable, unmaintained, or yanked crates. The `warden-cargo-audit` image wraps it for Techanv Warden — Warden's first **Rust SCA** coverage.

> **A Rust-native scanner.** Unlike the other scanners (Quarkus/Java wrappers), this one is written in **Rust** and talks to Warden's CI API (`/api/ci/scan`, `/api/ci/dependency`) directly over HTTP+JSON. It demonstrates that the ingest contract is language-agnostic — the same `createScan → uploadDependencies → completeScan` flow, ported to `reqwest`/`serde`.

## Local scan (Docker Compose)

```bash
SCAN_TARGET=/path/to/rust-repo docker compose --profile scan run --rm cargo-audit
```

The wrapper runs `cargo-audit audit --json` against the repo's `Cargo.lock`, maps each vulnerable crate to a Warden package + vulnerability, and uploads them through the SCA dependency path. Launch it from the UI on the **Scanner** page — see [Using Warden → Scanners](../../usage/scanners.md).

## How findings are mapped

- **Package** — `pkg:cargo/<name>@<version>`, type `cargo`, located at `Cargo.lock`.
- **Identity** — the advisory's CVE alias when present (so it dedups against the other SCA scanners), else the `RUSTSEC-YYYY-NNNN` id.
- **Severity** — bucketed from the advisory's CVSS (vector or base score: ≥9 Critical, ≥7 High, ≥4 Medium, >0 Low). RustSec advisories without a CVSS default to **High** (they are curated, real vulnerabilities).
- **Fixed version** — extracted from the first `versions.patched` requirement (e.g. `>= 0.14.10` → `0.14.10`).

## How it relates to the other SCA scanners

[Trivy](trivy.md), [Grype](grype.md), and [OSV-Scanner](osv.md) cover many ecosystems but RustSec is the **authoritative** source for Rust advisories (including unmaintained-crate and yanked-crate warnings that generic scanners miss). Run cargo-audit alongside them for Rust projects; findings dedup against the others by CVE identity. Pair with [OSV Enrichment](osv-enrichment.md) for live EPSS/KEV context.

## Notes

- cargo-audit reads `Cargo.lock` only — it does **not** build the project, so no Rust toolchain is needed at scan time.
- The image pre-clones the RustSec advisory-db and `git pull`s the latest advisories at scan time when the network is available; in a restricted network it falls back to the bundled copy.

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- A `Cargo.lock` in the scanned repository.
