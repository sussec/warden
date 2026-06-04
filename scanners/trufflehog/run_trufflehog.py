"""TruffleHog git-history secret-detection analyzer for Techanv Warden."""

import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from warden_client import WardenClient


def main() -> int:
    project = os.environ.get("PROJECT_PATH", "/src")

    client = WardenClient()
    scan_id = client.create_scan("trufflehog", "Secret", project)
    try:
        cmd = ["trufflehog", "filesystem", project, "--json", "--no-update"]
        print(f"[trufflehog] {' '.join(cmd)}")
        run = subprocess.run(cmd, capture_output=True, text=True)
        # trufflehog exits non-zero when secrets are found; only treat a missing
        # JSONL stream as a hard failure.
        if run.returncode != 0 and not run.stdout.strip():
            raise RuntimeError(run.stderr.strip()[-500:] or "trufflehog failed")

        findings: dict[str, dict] = {}
        for raw in run.stdout.splitlines():
            line = raw.strip()
            if not line:
                continue
            try:
                secret = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(secret, dict):
                continue

            fs = (
                secret.get("SourceMetadata", {})
                .get("Data", {})
                .get("Filesystem", {})
            )
            file = fs.get("file") or "unknown"
            file_line = fs.get("line") or 0
            detector = secret.get("DetectorName") or "secret"

            path = (
                os.path.relpath(file, project)
                if isinstance(file, str) and file.startswith("/")
                else file
            )

            identity = f"trufflehog:{detector}:{path}:{file_line}"
            if identity in findings:
                continue
            findings[identity] = {
                "identity": identity,
                "ruleId": detector,
                "name": f"{detector} secret",
                "description": (
                    f"Potential secret detected by detector `{detector}`. "
                    "Rotate the credential immediately and remove it from the "
                    "repository history."
                ),
                "category": "CWE-798",
                "severity": "Critical",
                "location": {
                    "path": path,
                    # never upload the matched secret itself
                    "snippet": None,
                    "startLine": file_line or None,
                },
            }

        client.upload_findings(scan_id, list(findings.values()))
        client.complete_scan(scan_id)
        return 0
    except Exception as exc:
        client.complete_scan(scan_id, str(exc))
        print(f"[trufflehog] failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
