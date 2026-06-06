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

# ---- runtime: official Dependency-Check image (carries the JRE + tool) ----
# Dependency-Check is a Java tool, so we reuse its official image as the runtime
# base (dependency-check.sh + bundled JRE on PATH) and drop the native scanner
# binary in. The native binary is glibc-linked, matching the glibc-based base.
FROM owasp/dependency-check:latest AS runtime
USER root
COPY --from=build /app/scanner-dependency-check/build/*-runner /opt/warden/dependency-check-scanner
ENV PATH="/usr/share/dependency-check/bin:${PATH}"
WORKDIR /src
ENTRYPOINT ["/opt/warden/dependency-check-scanner"]
