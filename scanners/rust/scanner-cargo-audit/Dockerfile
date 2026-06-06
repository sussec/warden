# cargo-audit (RustSec) SCA — Rust-native Warden scanner.
# Build from the scanners/rust directory:
#   docker build -f scanner-cargo-audit/Dockerfile -t warden-cargo-audit .

# ---- build: Rust toolchain builds both cargo-audit and our scanner ---------
FROM rust:1-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config libssl-dev git && rm -rf /var/lib/apt/lists/*
# Build the cargo-audit tool itself (RustSec).
RUN cargo install cargo-audit --locked --root /usr/local
# Build our scanner wrapper.
WORKDIR /app
COPY scanner-cargo-audit/Cargo.toml scanner-cargo-audit/Cargo.lock ./
COPY scanner-cargo-audit/src ./src
RUN cargo build --release --locked

# ---- runtime: glibc + git (advisory-db) + both binaries --------------------
# cargo-audit reads Cargo.lock directly (no cargo/rustc at runtime) but clones
# the RustSec advisory-db via git. We pre-clone it so scans work offline and
# still git-pull the latest advisories when the network is available.
FROM debian:stable-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates git && \
    git clone --depth 1 https://github.com/rustsec/advisory-db.git /root/.cargo/advisory-db && \
    rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/cargo-audit /usr/local/bin/cargo-audit
COPY --from=build /app/target/release/scanner-cargo-audit /opt/warden/cargo-audit-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/cargo-audit-scanner"]
