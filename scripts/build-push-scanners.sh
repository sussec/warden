#!/usr/bin/env bash
# Build and push every compose "scan" profile image so the UI fleet is E2E-ready.
#
# Usage:
#   REGISTRY=harbor.techanv.com/library ./scripts/build-push-scanners.sh
#   REGISTRY=harbor.techanv.com/library ./scripts/build-push-scanners.sh gitleaks semgrep trivy
#   PUSH=0 ./scripts/build-push-scanners.sh          # build only
#
# Images are tagged: ${REGISTRY}/warden-<scanner>:latest
# (matches SCAN_IMAGE_PREFIX=harbor.techanv.com/library/warden-)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REGISTRY="${REGISTRY:-harbor.techanv.com/library}"
PUSH="${PUSH:-1}"
PLATFORM="${PLATFORM:-linux/amd64}"

# Full fleet — keep in sync with ScanJobService.Fleet / docker-compose scan profile
ALL_SCANNERS=(
  semgrep gitleaks trufflehog trivy grype osv cve-lite
  cargo-audit cargo-deny cargo-geiger trivy-license
  kubescape prowler syft checkov guarddog deepsec codeql
  trivy-iac dependency-check kingfisher trivy-image zap nuclei nikto augustus
)

if [[ $# -gt 0 ]]; then
  SCANNERS=("$@")
else
  SCANNERS=("${ALL_SCANNERS[@]}")
fi

echo "==> Building ${#SCANNERS[@]} scanner image(s) for registry ${REGISTRY}"
echo "    PUSH=${PUSH} PLATFORM=${PLATFORM}"

failed=()
for s in "${SCANNERS[@]}"; do
  local_tag="warden-${s}:latest"
  remote_tag="${REGISTRY}/warden-${s}:latest"
  echo ""
  echo "---- ${s} → ${remote_tag}"
  if ! docker compose --profile scan build "${s}"; then
    echo "ERROR: build failed for ${s}" >&2
    failed+=("${s}")
    continue
  fi
  docker tag "${local_tag}" "${remote_tag}"
  if [[ "${PUSH}" == "1" ]]; then
    if ! docker push "${remote_tag}"; then
      echo "ERROR: push failed for ${remote_tag}" >&2
      failed+=("${s}")
      continue
    fi
  fi
  echo "OK ${s}"
done

echo ""
if ((${#failed[@]})); then
  echo "Failed: ${failed[*]}" >&2
  exit 1
fi
echo "All ${#SCANNERS[@]} scanner image(s) ready."
echo "API expects SCAN_IMAGE_PREFIX=${REGISTRY}/warden-"
