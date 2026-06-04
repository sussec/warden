"""Trivy IaC misconfiguration analyzer for Techanv Warden."""

import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from warden_client import WardenClient

SEVERITY = {
    "CRITICAL": "Critical",
    "HIGH": "High",
    "MEDIUM": "Medium",
    "LOW": "Low",
    "UNKNOWN": "Info",
}


def main() -> int:
    project = os.environ.get("PROJECT_PATH", "/src")
    output = "/tmp/trivy.json"

    client = WardenClient()
    scan_id = client.create_scan("trivy-iac", "Sast", project)
    try:
        cmd = [
            "trivy", "config", "--format", "json",
            "--output", output, project,
        ]
        print(f"[trivy-iac] {' '.join(cmd)}")
        run = subprocess.run(cmd, capture_output=True, text=True)
        if run.returncode != 0:
            raise RuntimeError(run.stderr.strip()[-500:] or "trivy failed")

        report = json.load(open(output))
        findings: list[dict] = []

        for result in report.get("Results", []) or []:
            target = result.get("Target", "")
            rel_path = os.path.relpath(target, project) if target else target
            for misconf in result.get("Misconfigurations", []) or []:
                cause = misconf.get("CauseMetadata", {}) or {}
                start_line = cause.get("StartLine")
                end_line = cause.get("EndLine")
                misconf_id = misconf.get("ID", "unknown")
                description = misconf.get("Description") or ""
                resolution = misconf.get("Resolution")
                if resolution:
                    description = f"{description}\n\nResolution: {resolution}"
                findings.append(
                    {
                        "identity": f"{misconf_id}:{rel_path}:{start_line}",
                        "ruleId": misconf_id,
                        "name": misconf.get("Title") or misconf_id,
                        "description": description[:4000],
                        "category": misconf_id,
                        "severity": SEVERITY.get(misconf.get("Severity", ""), "Info"),
                        "location": {
                            "path": rel_path,
                            "startLine": start_line,
                            "endLine": end_line,
                        },
                    }
                )

        client.upload_findings(scan_id, findings)
        client.complete_scan(scan_id)
        return 0
    except Exception as exc:
        client.complete_scan(scan_id, str(exc))
        print(f"[trivy-iac] failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
