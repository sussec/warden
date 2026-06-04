<div align="center">

![Techanv Warden](docs/assets/images/warden_banner.webp)

# Techanv Warden

**Application Security Posture Management for modern engineering teams.**

[![License](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/ghcr.io-sussec%2Fwarden-2496ED?logo=docker&logoColor=white)](https://github.com/orgs/sussec/packages)
[![.NET 8](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet&logoColor=white)](warden-api)
[![Angular 19](https://img.shields.io/badge/Angular-19-DD0031?logo=angular&logoColor=white)](warden-ui)

[Documentation](https://sussec.github.io/warden) · [Quick Start](#quick-start) · [CI/CD Integration](#cicd-integration) · [Support](#support)

</div>

---

Techanv Warden is a self-hosted **DevSecOps, ASPM (Application Security Posture Management), and vulnerability management platform**. It consolidates results from SAST, secret-detection, and SCA scanners running in your CI/CD pipelines into a single source of truth — with automatic deduplication, finding lifecycle tracking, SLA enforcement, and remediation workflows built in.

## Why Warden

| | |
|---|---|
| **Unified findings** | One dashboard for SAST, secrets, dependency, and container findings across every repository and branch. |
| **Smart deduplication** | Findings are fingerprinted per project — the same issue reported across 50 pipeline runs is one finding, not 50. |
| **Automatic fix detection** | When a confirmed finding disappears from the default branch, Warden marks it fixed — and reopens it if the fix is reverted. |
| **Shift-left feedback** | Scan results posted directly on merge requests, so developers see security issues before merge. |
| **Triage workflow** | Open → Confirmed → Fixed / Accepted Risk / False Positive, with full audit trail, comments, and per-project roles. |
| **Ticketing & alerting** | One-click Jira and Redmine tickets, Microsoft Teams and email alerts, weekly security digests. |
| **Enterprise auth** | OpenID Connect SSO (Keycloak, Entra ID, Okta, …) with reverse-proxy-aware redirect handling, plus local accounts. |

## Product Tour

**Executive dashboard** — organization-wide security posture, severity distribution, and trends at a glance.

![Warden dashboard](docs/assets/images/warden_dashboard.webp)

**Findings triage** — filter by severity, scanner, rule, branch, or project; bulk-update statuses; export to Excel or PDF.

![Findings triage](docs/assets/images/warden_findings.webp)

**Merge request feedback** — findings are commented directly on the MR/PR that introduced them.

![Pipeline integration](docs/assets/images/warden_pipeline.webp)

**Weekly security digest** — scheduled email and Teams reports keep stakeholders informed without dashboard fatigue.

![Weekly alerts](docs/assets/images/warden_alerts.webp)

## Architecture

![Architecture](docs/assets/images/warden_architecture.webp)

Warden ships as a **single container image** (`ghcr.io/sussec/warden`) bundling the .NET 8 API and Angular UI, backed by PostgreSQL. Scanner wrapper images run inside your existing CI pipelines and push results to Warden over HTTPS using scoped CI access tokens — Warden never needs access to your source code or build infrastructure.

| Component | Technology |
|---|---|
| `warden-api` | .NET 8 · ASP.NET Core · EF Core · PostgreSQL · Quartz.NET |
| `warden-ui` | Angular 19 · Tailwind CSS · PrimeNG |
| Scanners | Semgrep (SAST) · Gitleaks (secrets) · Trivy (SCA & containers) |

## Quick Start

```yaml
# docker-compose.yml
services:
  warden:
    image: ghcr.io/sussec/warden:latest
    depends_on: [db]
    environment:
      DB_SERVER: db
      DB_USERNAME: warden
      DB_PASSWORD: warden
      DB_NAME: warden
      SYSTEM_PASSWORD: "ChangeMe!"     # initial admin password
      ACCESS_TOKEN_KEY: ""             # set a random 32+ char secret
      REFRESH_TOKEN_KEY: ""            # set a random 32+ char secret
    ports:
      - "8080:8080"
  db:
    image: postgres
    environment:
      POSTGRES_USER: warden
      POSTGRES_PASSWORD: warden
      PGDATA: /data/postgres
    volumes:
      - warden_db:/data/postgres
    restart: unless-stopped

volumes:
  warden_db:
```

```bash
docker compose up -d
```

Then open `http://localhost:8080` and sign in as `system` with the password you configured. Full installation guide: [sussec.github.io/warden](https://sussec.github.io/warden).

## CI/CD Integration

Warden integrates with **GitLab CI/CD** and **GitHub Actions** through dedicated scanner images. Generate a CI access token under **Settings → Access Token**, then add a stage to your pipeline:

```yaml
# .gitlab-ci.yml — SAST with Semgrep
semgrep:
  stage: test
  image: ghcr.io/sussec/warden-semgrep:latest
  variables:
    WARDEN_URL: $WARDEN_URL
    WARDEN_TOKEN: $WARDEN_TOKEN
  script:
    - warden-scan
```

| Scanner | Type | Image |
|---|---|---|
| Semgrep | SAST (30+ languages) | `ghcr.io/sussec/warden-semgrep` |
| Gitleaks | Secret detection | `ghcr.io/sussec/warden-gitleaks` |
| Trivy | SCA, container images | `ghcr.io/sussec/warden-trivy` |

See the [Security Integration guide](https://sussec.github.io/warden/security-integration/) for GitHub Actions examples and per-scanner configuration.

## Integrations

- **Source control** — GitLab, GitHub, Bitbucket
- **Ticketing** — Jira (with bidirectional webhook status sync), Redmine
- **Alerting** — Microsoft Teams, SMTP email, scheduled weekly digests
- **Identity** — OpenID Connect SSO, local accounts, role-based access control

## Support

Techanv Warden is built and maintained by [Techanv Consulting](https://github.com/techanvconsulting) — cybersecurity and IT solutions.

- **Issues & feature requests** — [GitHub Issues](https://github.com/sussec/warden/issues)
- **Documentation** — [sussec.github.io/warden](https://sussec.github.io/warden)

## License

Copyright © 2026 Techanv Consulting. Distributed under the [BSD 3-Clause License](LICENSE).
