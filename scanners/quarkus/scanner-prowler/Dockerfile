# Prowler (cloud CSPM) — GraalVM native build, Quarkus scanner wrapper.
# Build from the scanners/quarkus directory:
#   docker build -f scanner-prowler/Dockerfile -t warden-prowler-quarkus .

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
RUN gradle --no-daemon :scanner-prowler:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: Python 3.12 (glibc) + prowler (pip) + native scanner --------
# Prowler is a Python tool. It supports Python >=3.9,<3.13, so we use a
# python:3.12-slim base (debian:stable-slim ships Python 3.13, which is outside
# prowler's range and would force the old 3.x line). Provider credentials are
# supplied at scan time via the container environment (AWS_*/AZURE_*/GCP).
FROM python:3.12-slim-bookworm AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    pip install --no-cache-dir prowler && \
    rm -rf /var/lib/apt/lists/* /root/.cache/pip
COPY --from=build /app/scanner-prowler/build/*-runner /opt/warden/prowler-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/prowler-scanner"]
