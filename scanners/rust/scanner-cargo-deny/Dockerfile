# cargo-deny (EmbarkStudios) advisories+license+bans — Rust-native Warden scanner.
# Build from the scanners/rust directory:
#   docker build -f scanner-cargo-deny/Dockerfile -t warden-cargo-deny .

# ---- build: Rust toolchain builds both cargo-deny and our scanner ----------
FROM rust:1-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config libssl-dev git && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-deny --locked --root /usr/local
WORKDIR /app
COPY scanner-cargo-deny/Cargo.toml scanner-cargo-deny/Cargo.lock ./
COPY scanner-cargo-deny/src ./src
RUN cargo build --release --locked

# ---- runtime: glibc + cargo (for `cargo metadata`) + git + both binaries ---
# Unlike cargo-audit (reads Cargo.lock directly), cargo-deny shells out to
# `cargo metadata` to resolve the dependency graph, so the cargo driver must be
# present at scan time. Debian's cargo package provides it.
FROM debian:stable-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates git cargo && \
    git clone --depth 1 https://github.com/rustsec/advisory-db.git /root/.cargo/advisory-db && \
    rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/cargo-deny /usr/local/bin/cargo-deny
COPY --from=build /app/target/release/scanner-cargo-deny /opt/warden/cargo-deny-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/cargo-deny-scanner"]
