# Kubescape

[Kubescape](https://github.com/kubescape/kubescape) (ARMO/CNCF) scans **Kubernetes manifests** against misconfiguration frameworks — **NSA-CISA**, **MITRE ATT&CK**, **CIS** — using OPA Rego controls over YAML, Helm, and Kustomize. Unlike the static IaC scanners (checkov, trivy-iac), it applies the K8s-hardening frameworks. The `warden-kubescape` image wraps it (manifest scanning, no live cluster needed).

## Local scan

```bash
SCAN_TARGET=/path/to/manifests docker compose --profile scan run --rm kubescape
# pick a framework (default nsa):
KUBESCAPE_FRAMEWORK=cis SCAN_TARGET=/path/to/manifests docker compose --profile scan run --rm kubescape
```

## Mapping

A finding is a **failed control on a resource**. The wrapper joins each failed `results[].controls[]` to `resources[]` (for the manifest path + kind/name/namespace) and to `summaryDetails.controls` (for severity, from the control's score: ≥9 Critical, ≥7 High, ≥4 Medium, else Low). Identity `kubescape:<C-id>:<resourceID>`.

## Notes

- Kubescape downloads its Rego framework artifacts on first run (network). In a restricted network, pre-bake them with `kubescape download artifacts` and pass `--use-artifacts-from` via `KUBESCAPE_ARGS`.

## Requirements

- A CI token as `WARDEN_TOKEN`; Kubernetes manifests in the repo.
