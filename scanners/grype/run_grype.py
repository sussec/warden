"""Grype SCA (dependency) analyzer for Techanv Warden."""

import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from warden_client import WardenClient

SEVERITY = {
    "Critical": "Critical",
    "High": "High",
    "Medium": "Medium",
    "Low": "Low",
    "Negligible": "Info",
    "Unknown": "Info",
}


def main() -> int:
    project = os.environ.get("PROJECT_PATH", "/src")
    output = "/tmp/grype.json"

    client = WardenClient()
    scan_id = client.create_scan("grype", "Dependency", project)
    try:
        cmd = ["grype", f"dir:{project}", "-o", "json", "--file", output]
        print(f"[grype] {' '.join(cmd)}")
        run = subprocess.run(cmd, capture_output=True, text=True)
        if run.returncode != 0:
            raise RuntimeError(run.stderr.strip()[-500:] or "grype failed")

        report = json.load(open(output))
        packages: dict[str, dict] = {}
        vulnerabilities: list[dict] = []

        for match in report.get("matches", []) or []:
            artifact = match.get("artifact", {}) or {}
            name = artifact.get("name", "unknown")
            version = artifact.get("version", "unknown")
            pkg_id = artifact.get("purl") or f"pkg:generic/{name}@{version}"

            locations = artifact.get("locations", []) or []
            location = locations[0].get("path") if locations else None

            packages.setdefault(
                pkg_id,
                {
                    "pkgId": pkg_id,
                    "name": name,
                    "version": version,
                    "type": artifact.get("type", "unknown"),
                    "location": location,
                },
            )

            vuln = match.get("vulnerability", {}) or {}
            vuln_id = vuln.get("id", "unknown")
            fix_versions = (vuln.get("fix", {}) or {}).get("versions", []) or []
            vulnerabilities.append(
                {
                    "identity": vuln_id,
                    "name": vuln_id,
                    "description": (vuln.get("description") or vuln_id)[:4000],
                    "fixedVersion": fix_versions[0] if fix_versions else "",
                    "severity": SEVERITY.get(vuln.get("severity", ""), "Info"),
                    "pkgId": pkg_id,
                    "pkgName": name,
                    "publishedAt": None,
                }
            )

        client.upload_dependencies(scan_id, list(packages.values()), vulnerabilities)
        client.complete_scan(scan_id)
        return 0
    except Exception as exc:
        client.complete_scan(scan_id, str(exc))
        print(f"[grype] failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
