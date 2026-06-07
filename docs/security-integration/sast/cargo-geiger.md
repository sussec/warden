# cargo-geiger

[cargo-geiger](https://github.com/geiger-rs/cargo-geiger) counts **`unsafe` code usage** across a Rust project's dependency tree — a code-safety signal that helps assess how much unsafe a project pulls in. The `warden-cargo-geiger` image wraps it as a **Rust-native** scanner; crates that actually use unsafe become informational findings.

## Local scan

```bash
SCAN_TARGET=/path/to/rust-repo docker compose --profile scan run --rm cargo-geiger
```

## Mapping

Each crate with non-zero used-`unsafe` counts → a finding: identity `cargo-geiger:<crate>@<version>`, severity **Low** (informational — unsafe is not a vulnerability by itself), with the unsafe-usage counts in the description.

## Notes

- **cargo-geiger compiles the project** (it instruments the build), so it needs the full Rust toolchain, the dependencies' build requirements, and network at scan time. It is heavier and more fragile than the other SCA scanners — treat its output as advisory. The image ships the toolchain for this reason.

## Requirements

- A CI token as `WARDEN_TOKEN`; a buildable `Cargo.toml` project.
