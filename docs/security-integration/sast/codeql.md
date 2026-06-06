# CodeQL

[CodeQL](https://codeql.github.com/) is GitHub's **semantic code-analysis engine** — it builds a queryable database from your source and runs data-flow / taint-tracking query suites to find vulnerabilities that pattern scanners miss (injection, SSRF, path traversal, unsafe deserialization, …). The `warden-codeql` image wraps the CodeQL CLI for Techanv Warden and ingests results as SAST findings.

## Local scan (Docker Compose)

```bash
SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm codeql
```

The wrapper detects which supported languages are present, builds a CodeQL database **cluster** with `--build-mode=none` (no project build required), runs each language's default `code-scanning` suite to SARIF, maps every result to a finding, and uploads them. Launch it from the UI on the **Scanner** page — see [Using Warden → Scanners](../../usage/scanners.md).

## Languages

Auto-detected from file extensions (no build step needed thanks to `--build-mode=none`):

| Language | CodeQL id |
|---|---|
| JavaScript / TypeScript | `javascript-typescript` |
| Python | `python` |
| Ruby | `ruby` |
| Java | `java` |
| C# | `csharp` |

Force a specific set with `CODEQL_LANGUAGES=python,javascript-typescript`. Compiled languages that lack build-mode-none support (Go, Kotlin, Swift) are intentionally not auto-run.

## How findings are mapped

CodeQL emits SARIF 2.1.0; the wrapper mirrors Warden's server-side SARIF mapper so severity is consistent however CodeQL is ingested. Each rule carries a `security-severity` (CVSS-like 0–10) in its SARIF properties:

- **Critical** ≥ 9.0 · **High** ≥ 7.0 · **Medium** ≥ 4.0 · **Low** > 0
- Falls back to the SARIF `level` (error → High, warning → Medium, note → Low) when no score is present.

Findings dedup per `ruleId:path:startLine`; the finding category is the rule's CWE tag.

## Options

| Variable | Effect |
|---|---|
| `CODEQL_LANGUAGES` | Comma-separated CodeQL language ids to force (default: auto-detect) |
| `CODEQL_THREADS` | Analysis threads (default `0` = one per core) |
| `CODEQL_RAM` | Analysis RAM budget in MB (passed to `--ram`) |

## Notes

- CodeQL is **resource-heavy**: the bundle is ~2–3 GB and analysis wants several GB of RAM per language — size the runner accordingly and bound large repos with `CODEQL_THREADS` / `CODEQL_RAM`.
- It complements the fast pattern scanners ([Semgrep](semgrep.md), Trivy IaC, Checkov): CodeQL's data-flow analysis finds deeper taint vulnerabilities, at higher cost.
- Licensing: GitHub CodeQL may be used on open-source codebases and for automated analysis under the terms in the CodeQL CLI license — review it for your usage.

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- A runner with enough RAM/disk for the CodeQL bundle and database build.
