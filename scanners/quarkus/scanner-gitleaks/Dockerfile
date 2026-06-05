# Quarkus gitleaks analyzer — GraalVM native build, reference port of the
# Python wrapper. Build from the scanners/quarkus directory:
#   docker build -f scanner-gitleaks/Dockerfile -t warden-gitleaks-jvm .
#
# Stage 1 compiles a native binary with Mandrel; stage 2 is a small glibc
# runtime carrying git, the gitleaks tool, and our native scanner.

# ---- build: Mandrel (GraalVM) + Gradle 8.10 -------------------------------
FROM quay.io/quarkus/ubi-quarkus-mandrel-builder-image:jdk-21 AS build
USER root
ARG GRADLE_VERSION=8.10.2
RUN microdnf install -y unzip git tar gzip && microdnf clean all && \
    curl -fsSL -o /tmp/gradle.zip https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip && \
    unzip -q /tmp/gradle.zip -d /opt && ln -s /opt/gradle-${GRADLE_VERSION}/bin/gradle /usr/local/bin/gradle && \
    rm /tmp/gradle.zip
WORKDIR /app
COPY settings.gradle gradle.properties ./
COPY warden-client ./warden-client
COPY scanner-gitleaks ./scanner-gitleaks
RUN gradle --no-daemon :scanner-gitleaks:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: glibc + git + gitleaks + native scanner ---------------------
FROM debian:stable-slim AS runtime
ARG GITLEAKS_VERSION=8.21.2
ARG TARGETARCH=amd64
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git curl && \
    arch="x64"; [ "$TARGETARCH" = "arm64" ] && arch="arm64"; \
    curl -fsSL -o /tmp/gitleaks.tar.gz \
        "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${arch}.tar.gz" && \
    tar -xzf /tmp/gitleaks.tar.gz -C /usr/local/bin gitleaks && \
    rm /tmp/gitleaks.tar.gz && apt-get purge -y curl && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*
COPY --from=build /app/scanner-gitleaks/build/*-runner /opt/warden/gitleaks-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/gitleaks-scanner"]
