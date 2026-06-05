# deepsec (AI-agent SAST)

[deepsec](https://github.com/vercel-labs/deepsec) is an AI-agent security harness. It runs ~110 regex matchers to flag security-sensitive files, then dispatches coding agents (Claude / GPT) to trace data flow, check mitigations, and confirm exploitable vulnerabilities — catching **logic and data-flow bugs that pattern-based SAST misses**, including in AI-generated code. A revalidation pass re-reads the code and git history to cut false positives.

The `warden-deepsec` image wraps it for Techanv Warden and ingests its findings through the SAST path (so they appear in the finding list and are commented inline on merge requests).

!!! warning "Cost and time"
    Unlike the deterministic scanners, deepsec's AI investigation **costs real model spend and takes minutes to hours** (roughly $25–60 for ~100 files, up to $500–1200 for 2,000). Always budget-cap with `DEEPSEC_LIMIT` and calibrate on a small sample first.

## Single source of truth: Warden's AI config

deepsec reuses the model endpoint Warden is already configured with — no separate key to manage:

| deepsec uses | from Warden |
|---|---|
| model gateway URL | `AI_ENDPOINT` |
| API key | `WARDEN_AI_API_KEY` |
| model | `AI_MODEL` (override with `DEEPSEC_MODEL`) |

Configure AI under **Setting → General → AI** (or the `AI_ENDPOINT` / `AI_MODEL` / `WARDEN_AI_API_KEY` environment variables). Any OpenAI-compatible endpoint works — Ollama, OpenRouter, Azure OpenAI, Anthropic, Gemini.

## Two modes

### Pipeline mode (default)

Runs the full `scan → process → export` pipeline against the mounted repo, using Warden's AI:

```bash
SCAN_TARGET=/path/to/repo DEEPSEC_LIMIT=50 \
  docker compose --profile scan run --rm deepsec
```

Tuning env: `DEEPSEC_LIMIT` (files investigated, default 50), `DEEPSEC_AGENT` (`codex` or `claude`, default `codex`), `DEEPSEC_MODEL`, `DEEPSEC_CONCURRENCY` (default 3), `DEEPSEC_REVALIDATE` (`true` to add the FP-cutting pass).

### Bridge mode

If you already run deepsec in a dedicated CI job (where cost and time are acceptable), export its findings there and let Warden ingest the JSON — no AI calls in Warden:

```bash
# in CI, after `deepsec export --format json --out findings.json`
DEEPSEC_REPORT=/path/to/findings.json \
  SCAN_TARGET=/path/to/repo docker compose --profile scan run --rm deepsec
```

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- Pipeline mode: a configured AI endpoint (`AI_ENDPOINT` + `WARDEN_AI_API_KEY`) and budget. Without it the scan fails fast with a clear message — run in bridge mode instead.
