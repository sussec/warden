# Techanv Warden

Techanv Warden is a self-hosted Application Security Posture Management (ASPM) and vulnerability management platform. It consolidates results from SAST, secret-detection, and SCA scanners running in your CI/CD pipelines into a single source of truth, with automatic deduplication, finding lifecycle tracking, SLA enforcement, and remediation workflows.

![Warden dashboard](assets/images/warden_dashboard.webp)

## Capabilities

| Capability | Description |
|---|---|
| Unified findings | One dashboard for SAST, secrets, dependency, and container findings across every repository and branch. |
| Deduplication | Findings are fingerprinted per project. The same issue reported across repeated pipeline runs is tracked as a single finding. |
| Fix detection | When a confirmed finding disappears from the default branch, Warden marks it fixed, and reopens it if the fix is reverted. |
| Shift-left feedback | Scan results are posted directly on merge requests so developers see security issues before merge. |
| Triage workflow | Open, Confirmed, Fixed, Accepted Risk, and False Positive statuses with a full audit trail, comments, and per-project roles. |
| Ticketing and alerting | Jira and Redmine ticket creation, Microsoft Teams and email alerts, and scheduled weekly digests. |
| Enterprise authentication | OpenID Connect single sign-on alongside local accounts, with role-based access control. |
| API-first | The complete platform API is described by an OpenAPI specification served at `/openapi/v1.json`, and a Model Context Protocol (MCP) endpoint is available at `/mcp` for agent integrations. |

## Architecture

![Architecture](assets/images/warden_architecture.webp)

Warden deploys as three services orchestrated with Docker Compose:

| Service | Description | Technology |
|---|---|---|
| `web` | Web application and same-origin API proxy; the single entry point for users | Next.js, React, Tailwind CSS, served by Bun |
| `warden` | Backend API: findings, projects, integrations, authentication, scheduling | .NET 10, ASP.NET Core, EF Core, Quartz.NET |
| `db` | Data store with vector search support for AI-assisted features | PostgreSQL with pgvector |

Scanner wrapper images run inside your existing CI pipelines and push results to Warden over HTTPS using scoped CI access tokens. Warden never requires access to your source code or build infrastructure.

## Next steps

- [Installation](installation.md): run the platform with Docker Compose.
- [System settings](setting/general.md): SMTP, authentication, and SLA configuration.
- [Security integration](security-integration/index.md): connect Semgrep, Gitleaks, and Trivy from your pipelines.
