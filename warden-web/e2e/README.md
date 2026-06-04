# End-to-end tests

Playwright specs that drive the real app in headless Chromium against the
running Docker stack.

## Prerequisites

Bring the stack up (web on `:8080`, api on `:5272`, db on `:54321`):

```bash
cd ..            # repo root
docker compose up -d --build
```

Seed sample data once (optional, makes finding/dependency tests meaningful):

```bash
docker run --rm --network warden_default \
  -e ASPNETCORE_ENVIRONMENT=Development \
  -e DB_SERVER=db -e DB_USERNAME=warden -e DB_PASSWORD=warden -e DB_NAME=warden \
  -e SYSTEM_PASSWORD="$SYSTEM_PASSWORD" \
  -e ACCESS_TOKEN_KEY=... -e REFRESH_TOKEN_KEY=... \
  ghcr.io/sussec/warden:latest    # boots once, seeds, then stop it
```

## Run

```bash
bun run test:e2e            # headless, list reporter
bun run test:e2e:ui        # interactive UI mode
bun run test:e2e:report    # open the last HTML report
```

Environment overrides:

| Var | Default | Purpose |
|---|---|---|
| `BASE_URL` | `http://localhost:8080` | target web app |
| `WARDEN_USER` | `system` | login user |
| `WARDEN_PASSWORD` | `ChangeMe_L0cal!` | login password |

`global-setup.ts` waits up to 30s for the stack and fails with a clear
message if it is not reachable.

## Suites

| File | Coverage |
|---|---|
| `01-auth` | bad creds, login, guard redirect, logout |
| `02-navigation` | all primary routes load clean; dark-mode toggle |
| `03-project` | list/filters, detail tabs, dependency drawer, SBOM/SARIF |
| `04-finding` | list/filters, detail, status change, comment |
| `05-admin` | integration cards, users, rules, ci-token, settings |
| `06-deep-interactions` | every dialog/filter/form |
| `07-mutations` | real writes: CI token, integrations, SLA, status, SBOM, export |

Every spec asserts zero console errors and zero unexpected 4xx/5xx via the
shared error tracker in `helpers.ts`.
