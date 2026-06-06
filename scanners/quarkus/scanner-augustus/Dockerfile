# Augustus (LLM red-team / GenAI security) — GraalVM native build, Quarkus wrapper.
# Build from the scanners/quarkus directory:
#   docker build -f scanner-augustus/Dockerfile -t warden-augustus-quarkus .

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
RUN gradle --no-daemon :scanner-augustus:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: glibc + augustus (prebuilt Go binary) + native scanner ------
# Augustus is a single static Go binary; pull the prebuilt release tarball so
# the runtime image needs no Go toolchain. amd64 asset shown; override
# AUGUSTUS_ARCH=arm64 to build for arm.
FROM debian:stable-slim AS runtime
ARG AUGUSTUS_VERSION=0.0.33
ARG AUGUSTUS_ARCH=amd64
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && \
    curl -fsSL -o /tmp/augustus.tgz \
        "https://github.com/praetorian-inc/augustus/releases/download/v${AUGUSTUS_VERSION}/augustus_${AUGUSTUS_VERSION}_linux_${AUGUSTUS_ARCH}.tar.gz" && \
    tar -xzf /tmp/augustus.tgz -C /usr/local/bin augustus && rm /tmp/augustus.tgz && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/scanner-augustus/build/*-runner /opt/warden/augustus-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/augustus-scanner"]
