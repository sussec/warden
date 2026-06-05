# deepsec — GraalVM native build, AI-agent SAST (vercel-labs/deepsec).
# Build from the scanners/quarkus directory:
#   docker build -f scanner-deepsec/Dockerfile -t warden-deepsec-quarkus .

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
RUN gradle --no-daemon :scanner-deepsec:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: Node 22 (glibc) + deepsec + native scanner ------------------
# deepsec needs Node.js 22+. The native binary orchestrates the deepsec CLI
# (pipeline mode) or ingests a deepsec export JSON (bridge mode, DEEPSEC_REPORT).
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git && \
    npm install -g deepsec && npm cache clean --force && \
    rm -rf /var/lib/apt/lists/*
COPY --from=build /app/scanner-deepsec/build/*-runner /opt/warden/deepsec-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/deepsec-scanner"]
