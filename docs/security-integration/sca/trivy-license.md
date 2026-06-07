# Trivy License

A dedicated **OSS-license** scanner built on the Trivy engine (`trivy fs --scanners license`). It surfaces per-package license-policy concerns — the license-compliance gap the vuln scanners don't cover — classifying each detected license by **Category** (Forbidden/Restricted/Reciprocal/Notice/…) and Severity. The `warden-trivy-license` image wraps it.

## Local scan

```bash
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm trivy-license
# scan loose-file license headers too:
TRIVY_LICENSE_FULL=true SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm trivy-license
```

## Mapping

Each `Results[].Licenses[]` entry → a finding: identity `trivy-license:<pkg>:<license>`, severity from Trivy's license `Severity` (else bucketed from Category: Forbidden→Critical, Restricted→High, Reciprocal→Medium, Notice/Permissive→Low). Pairs with the SCA scanners for a full dependency-risk picture.

## Requirements

- A CI token as `WARDEN_TOKEN`.
