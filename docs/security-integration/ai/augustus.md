# Augustus (LLM red-team)

[Augustus](https://github.com/praetorian-inc/augustus) is Praetorian's open-source **LLM vulnerability scanner**. It probes a target model — or any OpenAI-compatible / custom REST endpoint — with 210+ adversarial attacks (jailbreaks, prompt injection, encoding exploits, data extraction, agent attacks) and scores each response with one of 90+ detectors. The `warden-augustus` image wraps it for Techanv Warden under a new **`Ai`** scanner category, so GenAI risks land in the same dashboard, dedup, triage, and SLA workflow as your SAST/SCA/DAST findings.

This is the first member of Warden's **AI / LLM Security** pillar — testing the *model* layer of an application, not its source or dependencies.

## What it scans

Augustus targets a **live LLM endpoint**, not a code checkout. Each probe sends adversarial prompts and a detector scores the response; an attempt that the model fails (`passed: false`) becomes a Warden finding. Only failing (vulnerable) attempts are ingested — safe passes are not noise in your dashboard.

## Local scan (Docker Compose)

Smoke test with **no API key** (uses Augustus's built-in `test.Repeat` generator, which echoes prompts back so detectors fire):

```bash
AUGUSTUS_GENERATOR=test.Repeat AUGUSTUS_PROBES='exploitation.*' \
  docker compose --profile scan run --rm augustus
```

Against a hosted model (provider key read from the environment):

```bash
OPENAI_API_KEY=sk-... AUGUSTUS_GENERATOR=openai.OpenAI \
  AUGUSTUS_CONFIG='{"model":"gpt-4o-mini"}' \
  AUGUSTUS_PROBES='dan.*,promptinject.*,encoding.*' \
  docker compose --profile scan run --rm augustus
```

Against your own OpenAI-compatible / custom endpoint (no Augustus provider needed):

```bash
AUGUSTUS_GENERATOR=rest.Rest AUGUSTUS_CONFIG='{
  "uri": "https://your-llm.internal/v1/chat/completions",
  "method": "POST",
  "headers": {"Authorization": "Bearer YOUR_KEY"},
  "req_template_json_object": {"model":"custom","messages":[{"role":"user","content":"$INPUT"}]},
  "response_json": true,
  "response_json_field": "$.choices[0].message.content"
}' docker compose --profile scan run --rm augustus
```

## Severity mapping

Augustus reports a per-attempt `scores` array (0.0 safe … 1.0 vulnerable). A confirmed jailbreak/injection is a real exposure, so the wrapper floors severity at **Medium** and escalates:

- **Critical** — score ≥ 0.90
- **High** — score ≥ 0.50
- **Medium** — otherwise

Findings dedup per `probe + detector`, and the finding category is the probe family (`dan`, `encoding`, `promptinject`, …).

## Options

| Variable | Effect |
|---|---|
| `AUGUSTUS_GENERATOR` | **Required** — `rest.Rest`, `openai.OpenAI`, `anthropic.Anthropic`, `test.Repeat`, … |
| `AUGUSTUS_CONFIG` | Generator config JSON (rest.Rest endpoint, model, headers); passed to `--config` |
| `AUGUSTUS_PROBES` | Probe glob(s); default `dan.*,encoding.*,promptinject.*,goodside.*`. Set `ALL` to run every probe |
| `AUGUSTUS_DETECTORS` | Detector glob(s); default `*` |
| `AUGUSTUS_ARGS` | Extra raw CLI args appended verbatim (e.g. `--concurrency 5 --timeout 30m`) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Provider keys Augustus reads directly for hosted-model generators |

## Notes

- **Authorized testing only.** Augustus sends adversarial prompts to the model you specify; some probes elicit offensive content by design (to test safety filters). Only point it at endpoints you are authorized to test, and expect real provider token spend against hosted models.
- A full `AUGUSTUS_PROBES=ALL` run is large — start with a focused glob and widen once wired into CI.

## Requirements

- A CI access token (**Setting → Access Token**) exported as `WARDEN_TOKEN`.
- Network reachability to the target LLM endpoint, and a provider API key when targeting a hosted model.
