# Warden scanners — Quarkus port (reference)

A reference implementation of the Warden scanner fleet in **Quarkus (Java 21)**,
compiled to a **GraalVM native binary** for small images and fast startup. This
is the first step of migrating the Python wrappers under `scanners/` to Quarkus.

## Layout

```
scanners/quarkus/
├── settings.gradle            # Gradle multi-module (Quarkus 3.17, Java 21)
├── gradle.properties          # Quarkus platform + Jackson versions
├── warden-client/             # shared library (no Quarkus runtime)
│   └── …/client/
│       ├── WardenClient.java   # CI ingest: scan / finding / dependency / complete
│       ├── Env.java            # env + git helpers
│       ├── model/              # CiScanRequest, Finding, UploadFindingResponse, …
│       └── source/             # GitHub/GitLab MR comment posting (shift-left)
└── scanner-gitleaks/          # first scanner — picocli command, native
    ├── …/GitleaksCommand.java  # run gitleaks → map → ingest
    ├── …/ReflectionConfig.java # registers models for native Jackson
    ├── src/main/resources/application.properties
    └── Dockerfile              # Mandrel native build → glibc + gitleaks runtime
```

`warden-client` is a plain Java library (Jackson + `java.net.http`) so it can be
reused by every scanner module. Each scanner is a tiny Quarkus picocli command.

## Build

The repo's local Gradle may be newer than the Quarkus plugin supports (it needs
Gradle 8.x). Build in Docker, which is also how the images ship:

```bash
cd scanners/quarkus

# JVM build (fast — validates compilation)
docker run --rm -v "$PWD":/app -w /app gradle:8.10-jdk21 \
  gradle --no-daemon :scanner-gitleaks:quarkusBuild -x test

# Native scanner image (Mandrel build + gitleaks runtime)
docker build -f scanner-gitleaks/Dockerfile -t warden-gitleaks-quarkus .
```

Run it like the Python scanners (same env contract):

```bash
docker run --rm \
  -e WARDEN_URL=http://warden:8080 -e WARDEN_TOKEN=<token> \
  -v /path/to/repo:/src:ro \
  warden-gitleaks-quarkus
```

## Parity with the Python wrappers

The Quarkus client implements the same CI ingest contract and the same
shift-left behaviour:

- `POST /api/ci/scan`, `/finding`, `/dependency`, `PUT /scan/{id}`
- merge-request detection (GitHub Actions / GitLab CI) → `gitAction=MergeRequest`
- inline review comments for newly introduced findings (GitHub PR review,
  GitLab MR discussion), best-effort and never failing the scan

## Rolling out to the rest of the fleet

Each remaining scanner becomes a new `scanner-<name>` module with a single
picocli command that shells out to the tool, maps its output to `Finding` /
dependency models, and calls the shared `WardenClient`. SCA scanners
(`trivy`, `grype`) add `Package` / `Vulnerability` models + `uploadDependencies`
to `warden-client`; DAST/container scanners (`zap`, `nuclei`, `trivy-image`)
follow the same pattern with their target env (`TARGET_URL`, `IMAGE_REF`).
