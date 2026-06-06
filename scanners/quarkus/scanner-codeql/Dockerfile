# CodeQL (GitHub SAST) — GraalVM native build, Quarkus scanner wrapper.
# Build from the scanners/quarkus directory:
#   docker build -f scanner-codeql/Dockerfile -t warden-codeql-quarkus .

# ---- build: Mandrel (GraalVM) + Gradle ------------------------------------
FROM quay.io/quarkus/ubi-quarkus-mandrel-builder-image:jdk-21 AS build
USER root
ARG GRADLE_VERSION=8.10.2
RUN microdnf install -y unzip tar gzip && microdnf clean all && \
    curl -fsSL -o /tmp/gradle.zip https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip && \
    unzip -q /tmp/gradle.zip -d /opt && ln -s /opt/gradle-${GRADLE_VERSION}/bin/gradle /usr/local/bin/gradle && \
    rm /tmp/gradle.zip
WORKDIR /app
COPY . .
RUN gradle --no-daemon :scanner-codeql:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: glibc + CodeQL bundle (self-contained) + native scanner -----
# The CodeQL bundle ships the CLI plus all query packs and extractors; with
# --build-mode=none it needs no per-language build toolchain. git is included
# because some extractors read repository metadata.
# python3 is required by CodeQL's Python extractor (it enumerates the
# interpreter environment); the other supported extractors are self-contained.
FROM debian:stable-slim AS runtime
ARG CODEQL_VERSION=v2.25.6
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl git python3 && \
    curl -fsSL -o /tmp/codeql.tar.gz \
        "https://github.com/github/codeql-action/releases/download/codeql-bundle-${CODEQL_VERSION}/codeql-bundle-linux64.tar.gz" && \
    tar -xzf /tmp/codeql.tar.gz -C /opt && rm /tmp/codeql.tar.gz && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
ENV PATH="/opt/codeql:${PATH}"
COPY --from=build /app/scanner-codeql/build/*-runner /opt/warden/codeql-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/codeql-scanner"]
