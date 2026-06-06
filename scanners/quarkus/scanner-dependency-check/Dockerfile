# OWASP Dependency-Check — GraalVM native build, Quarkus scanner wrapper.
# Build from the scanners/quarkus directory:
#   docker build -f scanner-dependency-check/Dockerfile -t warden-dependency-check-quarkus .

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
RUN gradle --no-daemon :scanner-dependency-check:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: glibc (Debian) + JRE + Dependency-Check CLI + native scanner --
# The official owasp/dependency-check image is Alpine/musl, which CANNOT exec our
# glibc Mandrel native binary. So we build a glibc runtime: Debian + a headless
# JRE (Dependency-Check is a Java tool, needs Java 11+) + the Dependency-Check
# release zip from GitHub. This keeps the native scanner and the tool on the
# same glibc base.
FROM debian:stable-slim AS runtime
ARG DC_VERSION=12.2.2
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl unzip default-jre-headless && \
    curl -fsSL -o /tmp/dc.zip \
        "https://github.com/dependency-check/DependencyCheck/releases/download/v${DC_VERSION}/dependency-check-${DC_VERSION}-release.zip" && \
    unzip -q /tmp/dc.zip -d /opt && rm /tmp/dc.zip && \
    ln -s /opt/dependency-check/bin/dependency-check.sh /usr/local/bin/dependency-check.sh && \
    apt-get purge -y curl unzip && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/scanner-dependency-check/build/*-runner /opt/warden/dependency-check-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/dependency-check-scanner"]
