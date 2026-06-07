# cargo-geiger (unsafe-usage) — Rust-native Warden scanner.
# Build from the scanners/rust directory:
#   docker build -f scanner-cargo-geiger/Dockerfile -t warden-cargo-geiger .

# ---- build: Rust toolchain builds both cargo-geiger and our scanner --------
FROM rust:1-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-geiger --locked --root /usr/local
WORKDIR /app
COPY scanner-cargo-geiger/Cargo.toml scanner-cargo-geiger/Cargo.lock ./
COPY scanner-cargo-geiger/src ./src
RUN cargo build --release --locked

# ---- runtime: KEEP the Rust toolchain — cargo-geiger COMPILES the scanned --
# project (and its dependencies) to instrument unsafe usage, so cargo, rustc, a
# C toolchain, and common build libs must be present at scan time.
FROM rust:1-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates git build-essential pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/cargo-geiger /usr/local/bin/cargo-geiger
COPY --from=build /app/target/release/scanner-cargo-geiger /opt/warden/cargo-geiger-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/cargo-geiger-scanner"]
