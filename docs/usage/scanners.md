# Scanners

The **Scanner** page (sidebar → **Scanner**) is the home of Warden's scan fleet. It shows which scanners have reported to this instance, the history of on-demand runs, and lets you launch a scan from the UI without touching a terminal.

## Registered scanners

The top card lists every scanner that has ever reported results to this Warden instance, with a type badge (SAST, SECRET, SCA, CONTAINER, DAST). A scanner appears here automatically the first time it ingests a scan — through CI, the compose `scan` profile, or a UI-triggered run.

## On-demand scan fleet

Below the run history, each bundled scanner has a card with a short description, a copyable CLI command, and a **Run** button. Cards marked **Active** have already reported to this instance.

The fleet mirrors the `scan` profile in `docker-compose.yml`:

| Scanner | Type | Target |
|---|---|---|
| semgrep | SAST | repository path |
| deepsec | SAST (AI-agent) | repository path |
| gitleaks | Secret | repository path |
| trufflehog | Secret | repository path |
| trivy | SCA | repository path |
| grype | SCA | repository path |
| osv | SCA / supply-chain | repository path |
| syft | SBOM | repository path |
| checkov | SAST (misconfig) | repository path |
| guarddog | supply-chain | repository path |
| trivy-iac | SAST (misconfig) | repository path |
| trivy-image | Container | image reference |
| zap | DAST | target URL |
| nuclei | DAST | target URL |

## Running a scan from the UI

Click **Run** on a scanner card to open the run dialog. Depending on the scanner type you provide:

- **Repository path** — an absolute path on the Docker host (e.g. `/srv/projects/my-repo`), plus optional project name and branch.
- **Image reference** — e.g. `nginx:1.27` for `trivy-image`.
- **Target URL** — e.g. `https://staging.example.com` for `zap` and `nuclei`.

Warden queues the job, then the built-in runner launches the matching scanner image as a **sibling container** over the Docker socket, captures its exit code and log tail, and records the result. The **Scan Runs** table updates live — status badges move through Queued → Running → Succeeded / Failed, with duration and a log viewer per run.

!!! warning "How it works (docker-out-of-docker)"
    UI-triggered scans require the Warden API container to reach the host Docker daemon. The runner launches scanner containers as *siblings* of the API container via the mounted Docker socket — it is **not** Docker-in-Docker and needs no `--privileged` flag. See [Installation → UI-triggered scans](../installation.md#ui-triggered-scans) for the socket mount and `DOCKER_GID` setup. If the socket is not mounted, the runner stays idle and the **Run** buttons return an error; the CLI commands still work.

## Requirements

- The `scan`-profile scanner images must be built locally (`docker compose --profile scan build`) or available to the daemon, since the runner launches them by name (`warden-semgrep`, `warden-gitleaks`, …).
- A CI access token (**Setting → Access Token**) set as `WARDEN_TOKEN` in `.env`, so scanners can ingest results.

## CLI equivalent

Every card's copy button yields the exact compose command, identical to a CI job:

```bash
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm semgrep
SCAN_IMAGE_REF=nginx:1.27   docker compose --profile scan run --rm trivy-image
SCAN_TARGET_URL=https://staging.example.com docker compose --profile scan run --rm zap
```

See [Security Integration](../security-integration/index.md) for the full per-scanner reference and CI pipeline examples.
