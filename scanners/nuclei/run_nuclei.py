"""Nuclei template-based DAST analyzer for Techanv Warden."""

import json
import os
import subprocess
import sys
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from warden_client import WardenClient

# nuclei info.severity -> Warden severity
SEVERITY = {
    "critical": "Critical",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "info": "Info",
}


def main() -> int:
    target = os.environ.get("TARGET_URL")
    if not target:
        print("[nuclei] missing required environment variable TARGET_URL", file=sys.stderr)
        return 2

    # DAST scans a URL, not a repo checkout. Derive a repo name from the target.
    host = urlparse(target).netloc or target
    os.environ["REPO_NAME"] = os.environ.get("REPO_NAME") or host

    output = "/tmp/nuclei.jsonl"
    client = WardenClient()
    scan_id = client.create_scan("nuclei", "Dast", "/tmp")
    try:
        cmd = ["nuclei", "-u", target, "-jsonl", "-o", output, "-silent"]
        print(f"[nuclei] {' '.join(cmd)}")
        subprocess.run(cmd, capture_output=True, text=True)

        findings = []
        if os.path.exists(output):
            with open(output) as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    r = json.loads(line)
                    info = r.get("info", {}) or {}
                    template_id = r.get("template-id", "")
                    matched_at = r.get("matched-at") or target
                    severity = SEVERITY.get(
                        str(info.get("severity", "")).lower(), "Info"
                    )
                    cwe_ids = ((info.get("classification") or {}).get("cwe-id")) or []
                    category = cwe_ids[0] if cwe_ids else None
                    findings.append(
                        {
                            "identity": f"nuclei:{template_id}:{matched_at}",
                            "ruleId": str(template_id),
                            "name": info.get("name") or template_id or "Nuclei finding",
                            "description": info.get("description")
                            or info.get("name")
                            or template_id,
                            "category": category,
                            "severity": severity,
                            "location": {"path": matched_at},
                        }
                    )

        client.upload_findings(scan_id, findings)
        client.complete_scan(scan_id)
        return 0
    except Exception as exc:  # report scan failure to Warden before exiting
        client.complete_scan(scan_id, str(exc))
        print(f"[nuclei] failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
