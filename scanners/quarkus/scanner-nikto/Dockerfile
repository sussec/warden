# Nikto — GraalVM native build, Quarkus scanner wrapper.
# Build from the scanners/quarkus directory:
#   docker build -f scanner-nikto/Dockerfile -t warden-nikto-quarkus .

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
RUN gradle --no-daemon :scanner-nikto:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: glibc + nikto (Perl, from GitHub) + native scanner ---------
# Debian's packaged nikto is 2.1.5 (pre-JSON). Install nikto 2.5.0 from GitHub
# — it is pure Perl, so we just need the interpreter plus Net::SSLeay for HTTPS.
# A /usr/local/bin/nikto launcher execs nikto.pl from its program dir (nikto
# resolves its databases/plugins relative to that directory).
FROM debian:stable-slim AS runtime
ARG NIKTO_VERSION=2.5.0
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl perl libnet-ssleay-perl && \
    curl -fsSL -o /tmp/nikto.tar.gz \
        "https://github.com/sullo/nikto/archive/refs/tags/${NIKTO_VERSION}.tar.gz" && \
    mkdir -p /opt/nikto && tar -xzf /tmp/nikto.tar.gz -C /opt/nikto --strip-components=1 && \
    rm /tmp/nikto.tar.gz && \
    printf '#!/bin/sh\nexec perl /opt/nikto/program/nikto.pl "$@"\n' > /usr/local/bin/nikto && \
    chmod +x /usr/local/bin/nikto && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/scanner-nikto/build/*-runner /opt/warden/nikto-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/nikto-scanner"]
