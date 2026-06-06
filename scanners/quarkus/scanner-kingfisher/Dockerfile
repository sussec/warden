# Kingfisher — GraalVM native build, Quarkus scanner wrapper.
# Build from the scanners/quarkus directory:
#   docker build -f scanner-kingfisher/Dockerfile -t warden-kingfisher-quarkus .

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
RUN gradle --no-daemon :scanner-kingfisher:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: glibc + kingfisher (from official image) + native scanner --
FROM ghcr.io/mongodb/kingfisher:latest AS kingfisher

FROM debian:stable-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*
# Pull the kingfisher binary from its official image (avoids re-running the
# install script / fetching release archives at build time).
COPY --from=kingfisher /usr/local/bin/kingfisher /usr/local/bin/kingfisher
COPY --from=build /app/scanner-kingfisher/build/*-runner /opt/warden/kingfisher-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/kingfisher-scanner"]
