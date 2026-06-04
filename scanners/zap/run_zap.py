"""OWASP ZAP baseline DAST analyzer for Techanv Warden."""

import json
import os
import re
import subprocess
import sys
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from warden_client import WardenClient

# ZAP riskcode -> Warden severity
SEVERITY = {3: "High", 2: "Medium", 1: "Low", 0: "Info"}

_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(text: str) -> str:
    if not text:
        return ""
    # drop tags, collapse whitespace
    return re.sub(r"\s+", " ", _TAG_RE.sub(" ", text)).strip()


def main() -> int:
    target = os.environ.get("TARGET_URL")
    if not target:
        print("[zap] missing required environment variable TARGET_URL", file=sys.stderr)
        return 2

    # DAST scans a URL, not a repo checkout. Derive a repo name from the target.
    host = urlparse(target).netloc or target
    os.environ["REPO_NAME"] = os.environ.get("REPO_NAME") or host

    # zap-baseline.py writes -J reports into its work dir (/zap/wrk), not an
    # absolute path; use a writable work dir and read the report back from there.
    work_dir = "/zap/wrk"
    os.makedirs(work_dir, exist_ok=True)
    report_name = "zap.json"
    output = os.path.join(work_dir, report_name)
    client = WardenClient()
    scan_id = client.create_scan("zap", "Dast", "/tmp")
    try:
        # zap-baseline.py ships in the ZAP image. -I = do not fail on warnings.
        cmd = ["zap-baseline.py", "-t", target, "-J", report_name, "-I"]
        print(f"[zap] {' '.join(cmd)}")
        # zap-baseline exits non-zero by design (warn/fail counts); ignore rc, rely on report.
        run = subprocess.run(cmd, capture_output=True, text=True, cwd=work_dir)

        if not os.path.exists(output):
            tail = (run.stdout or run.stderr or "")[-400:]
            raise RuntimeError(f"zap-baseline produced no report. {tail}")

        report = json.load(open(output))
        findings = []
        for site in report.get("site", []):
            for alert in site.get("alerts", []):
                plugin = alert.get("pluginid", "")
                riskcode = alert.get("riskcode", "0")
                try:
                    risk = int(riskcode)
                except (TypeError, ValueError):
                    risk = 0
                cwe = alert.get("cweid")
                category = (
                    f"CWE-{cwe}" if str(cwe) not in ("-1", "", "None") else None
                )
                desc = strip_html(alert.get("desc", ""))
                solution = strip_html(alert.get("solution", ""))
                description = desc
                if solution:
                    description = f"{desc}\n\nSolution: {solution}".strip()

                instances = alert.get("instances") or [{}]
                for inst in instances:
                    uri = inst.get("uri") or target
                    findings.append(
                        {
                            "identity": f"zap:{plugin}:{uri}",
                            "ruleId": str(plugin),
                            "name": alert.get("alert") or alert.get("name") or "ZAP alert",
                            "description": description or (alert.get("alert") or "ZAP alert"),
                            "category": category,
                            "severity": SEVERITY.get(risk, "Info"),
                            "location": {"path": uri},
                        }
                    )

        client.upload_findings(scan_id, findings)
        client.complete_scan(scan_id)
        return 0
    except Exception as exc:  # report scan failure to Warden before exiting
        client.complete_scan(scan_id, str(exc))
        print(f"[zap] failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
