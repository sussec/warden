# GuardDog — GraalVM native build, malicious-package detection.
# Build from the scanners/quarkus directory:
#   docker build -f scanner-guarddog/Dockerfile -t warden-guarddog-quarkus .

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
RUN gradle --no-daemon :scanner-guarddog:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: python (glibc) + guarddog + native scanner -----------------
FROM python:3.12-slim AS runtime
RUN pip install --no-cache-dir guarddog && \
    apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/scanner-guarddog/build/*-runner /opt/warden/guarddog-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/guarddog-scanner"]
