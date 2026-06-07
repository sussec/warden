# Kubescape (K8s posture) — GraalVM native build, Quarkus scanner wrapper.
# Build from the scanners/quarkus directory:
#   docker build -f scanner-kubescape/Dockerfile -t warden-kubescape-quarkus .

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
RUN gradle --no-daemon :scanner-kubescape:quarkusBuild -Dquarkus.native.enabled=true \
        -Dquarkus.native.container-build=false -Dquarkus.package.jar.enabled=false

# ---- runtime: glibc + kubescape binary + native scanner -------------------
# Kubescape downloads its Rego framework artifacts over the network on first
# run; in a restricted network pre-bake them with `kubescape download artifacts`
# and pass --use-artifacts-from via KUBESCAPE_ARGS.
FROM debian:stable-slim AS runtime
ARG KUBESCAPE_VERSION=v4.0.9
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && \
    curl -fsSL -o /usr/local/bin/kubescape \
        "https://github.com/kubescape/kubescape/releases/download/${KUBESCAPE_VERSION}/kubescape_4.0.9_linux_amd64" && \
    chmod +x /usr/local/bin/kubescape && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/scanner-kubescape/build/*-runner /opt/warden/kubescape-scanner
WORKDIR /src
ENTRYPOINT ["/opt/warden/kubescape-scanner"]
