# Syft — GraalVM native build, SBOM generation (supply-chain inventory).
# Build from the scanners/quarkus directory:
#   docker build -f scanner-syft/Dockerfile -t warden-syft-quarkus .

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
RUN gradle --no-daemon :scanner-syft:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: glibc + syft + native scanner ------------------------------
FROM debian:stable-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git curl && \
    curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/scanner-syft/build/*-runner /opt/warden/syft-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/syft-scanner"]
