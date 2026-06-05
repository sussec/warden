# OSV-Scanner — GraalVM native build, SCA + supply-chain (OSV.dev).
# Build from the scanners/quarkus directory:
#   docker build -f scanner-osv/Dockerfile -t warden-osv-quarkus .

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
RUN gradle --no-daemon :scanner-osv:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: glibc + osv-scanner + native scanner ------------------------
FROM debian:stable-slim AS runtime
ARG OSV_VERSION=1.9.2
ARG TARGETARCH=amd64
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git curl && \
    curl -fsSL -o /usr/local/bin/osv-scanner \
        "https://github.com/google/osv-scanner/releases/download/v${OSV_VERSION}/osv-scanner_linux_${TARGETARCH}" && \
    chmod +x /usr/local/bin/osv-scanner && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/scanner-osv/build/*-runner /opt/warden/osv-scanner-runner
WORKDIR /src
ENTRYPOINT ["/opt/warden/osv-scanner-runner"]
