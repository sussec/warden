# Prowler

[Prowler](https://github.com/prowler-cloud/prowler) is an open-source **Cloud Security Posture Management (CSPM)** tool. It audits a live **AWS / Azure / GCP** account against CIS, SOC2, PCI, and many other frameworks (hundreds of checks). The `warden-prowler` image wraps it under Warden's new **Cloud** scanner category — the model layer Warden previously had zero coverage of.

## Local scan

Prowler assesses a **cloud account**, not a checkout — provide provider credentials via the environment:

```bash
PROWLER_PROVIDER=aws \
  AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_DEFAULT_REGION=us-east-1 \
  docker compose --profile scan run --rm prowler
```

The wrapper runs `prowler <provider> --output-formats json-ocsf --status FAIL`, maps each FAIL result from the OCSF report to a finding, and uploads it. `PROWLER_ARGS` passes extra flags (e.g. `--service iam`, `--compliance cis_2.0_aws`).

## Mapping

Each FAIL finding → identity `prowler:<check_id>:<resource_uid>`, severity from the OCSF `severity`, name from `finding_info.title`, location `<resource> · <region>`, category the cloud provider.

## Requirements

- A CI token as `WARDEN_TOKEN`.
- **Cloud credentials** for the target provider (read-only/security-audit role recommended), supplied as environment variables.
- Authorization to assess the target account — Prowler makes many read API calls.
