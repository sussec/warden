"""Semgrep SAST analyzer for Techanv Warden."""

import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from warden_client import WardenClient

SEVERITY = {"ERROR": "High", "WARNING": "Medium", "INFO": "Info"}
# semgrep metadata severities are more precise when present
META_SEVERITY = {
    "critical": "Critical",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "info": "Info",
}


def severity_of(result: dict) -> str:
    meta = (result.get("extra", {}).get("metadata", {}) or {}).get("impact", "")
    if isinstance(meta, str) and meta.lower() in META_SEVERITY:
        return META_SEVERITY[meta.lower()]
    return SEVERITY.get(result.get("extra", {}).get("severity", ""), "Info")


def main() -> int:
    project = os.environ.get("PROJECT_PATH", "/src")
    rules = os.environ.get("SEMGREP_RULES", "p/default")
    output = "/tmp/semgrep.json"

    client = WardenClient()
    scan_id = client.create_scan("semgrep", "Sast", project)
    try:
        cmd = [
            "semgrep", "scan", "--json", "--output", output,
            "--config", rules, "--metrics", "off", project,
        ]
        excluded = os.environ.get("SEMGREP_EXCLUDED_PATHS")
        if excluded:
            for path in excluded.split(","):
                cmd[1:1] = []  # keep subcommand first
                cmd.extend(["--exclude", path.strip()])
        print(f"[semgrep] {' '.join(cmd)}")
        run = subprocess.run(cmd, capture_output=True, text=True)
        if run.returncode not in (0, 1):  # 1 = findings present
            raise RuntimeError(run.stderr.strip()[-500:] or "semgrep failed")

        results = json.load(open(output)).get("results", [])
        findings = []
        for r in results:
            path = os.path.relpath(r["path"], project)
            rule = r["check_id"]
            extra = r.get("extra", {})
            findings.append(
                {
                    "identity": f"{rule}:{path}:{r['start']['line']}",
                    "ruleId": rule,
                    "name": rule.split(".")[-1].replace("-", " ").title(),
                    "description": extra.get("message", rule),
                    "category": ",".join(
                        (extra.get("metadata", {}) or {}).get("cwe", [])[:1]
                    ) or None,
                    "severity": severity_of(r),
                    "location": {
                        "path": path,
                        "snippet": extra.get("lines", "")[:2000] or None,
                        "startLine": r["start"]["line"],
                        "endLine": r["end"]["line"],
                    },
                }
            )
        client.upload_findings(scan_id, findings)
        client.complete_scan(scan_id)
        return 0
    except Exception as exc:  # report scan failure to Warden before exiting
        client.complete_scan(scan_id, str(exc))
        print(f"[semgrep] failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
