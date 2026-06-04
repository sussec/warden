"""Gitleaks secret-detection analyzer for Techanv Warden."""

import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from warden_client import WardenClient


def main() -> int:
    project = os.environ.get("PROJECT_PATH", "/src")
    output = "/tmp/gitleaks.json"

    client = WardenClient()
    scan_id = client.create_scan("gitleaks", "Secret", project)
    try:
        cmd = [
            "gitleaks", "detect", "--source", project, "--no-git",
            "--report-format", "json", "--report-path", output, "--exit-code", "0",
        ]
        print(f"[gitleaks] {' '.join(cmd)}")
        run = subprocess.run(cmd, capture_output=True, text=True)
        if run.returncode != 0:
            raise RuntimeError(run.stderr.strip()[-500:] or "gitleaks failed")

        leaks = []
        if os.path.exists(output) and os.path.getsize(output) > 0:
            leaks = json.load(open(output)) or []

        findings = []
        for leak in leaks:
            path = os.path.relpath(leak.get("File", "unknown"), project) \
                if leak.get("File", "").startswith("/") else leak.get("File", "unknown")
            rule = leak.get("RuleID", "secret")
            line = leak.get("StartLine", 0)
            findings.append(
                {
                    "identity": f"gitleaks:{rule}:{path}:{leak.get('Fingerprint', line)}",
                    "ruleId": rule,
                    "name": leak.get("Description", rule),
                    "description": (
                        f"Potential secret detected by rule `{rule}`. "
                        "Rotate the credential and remove it from the repository history."
                    ),
                    "category": "CWE-798",
                    "severity": "Critical",
                    "location": {
                        "path": path,
                        # never upload the matched secret itself
                        "snippet": None,
                        "startLine": line or None,
                        "endLine": leak.get("EndLine") or None,
                    },
                }
            )
        client.upload_findings(scan_id, findings)
        client.complete_scan(scan_id)
        return 0
    except Exception as exc:
        client.complete_scan(scan_id, str(exc))
        print(f"[gitleaks] failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
