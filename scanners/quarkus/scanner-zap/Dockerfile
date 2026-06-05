# OWASP ZAP — GraalVM native build, Quarkus port of the Python wrapper.
# Build from the scanners/quarkus directory:
#   docker build -f scanner-zap/Dockerfile -t warden-zap-quarkus .

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
RUN gradle --no-daemon :scanner-zap:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: official ZAP image (glibc) + native scanner ----------------
FROM ghcr.io/zaproxy/zaproxy:stable AS runtime
USER root
COPY --from=build /app/scanner-zap/build/*-runner /opt/warden/zap-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/zap-scanner"]
