"""Trivy SCA (dependency) analyzer for Techanv Warden."""

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
    scan_id = client.create_scan("trivy", "Dependency", project)
    try:
        cmd = [
            "trivy", "fs", "--scanners", "vuln", "--format", "json",
            "--output", output, "--list-all-pkgs", project,
        ]
        print(f"[trivy] {' '.join(cmd)}")
        run = subprocess.run(cmd, capture_output=True, text=True)
        if run.returncode != 0:
            raise RuntimeError(run.stderr.strip()[-500:] or "trivy failed")

        report = json.load(open(output))
        packages: dict[str, dict] = {}
        vulnerabilities: list[dict] = []

        for result in report.get("Results", []) or []:
            target = result.get("Target", "")
            for pkg in result.get("Packages", []) or []:
                pkg_id = pkg.get("Identifier", {}).get("PURL") or (
                    f"pkg:generic/{pkg.get('Name')}@{pkg.get('Version')}"
                )
                packages.setdefault(
                    pkg_id,
                    {
                        "pkgId": pkg_id,
                        "name": pkg.get("Name", "unknown"),
                        "version": pkg.get("Version", "unknown"),
                        "type": result.get("Type", "unknown"),
                        "location": target or None,
                    },
                )
            for vuln in result.get("Vulnerabilities", []) or []:
                pkg_id = vuln.get("PkgIdentifier", {}).get("PURL") or (
                    f"pkg:generic/{vuln.get('PkgName')}@{vuln.get('InstalledVersion')}"
                )
                packages.setdefault(
                    pkg_id,
                    {
                        "pkgId": pkg_id,
                        "name": vuln.get("PkgName", "unknown"),
                        "version": vuln.get("InstalledVersion", "unknown"),
                        "type": result.get("Type", "unknown"),
                        "location": target or None,
                    },
                )
                vulnerabilities.append(
                    {
                        "identity": vuln.get("VulnerabilityID", "unknown"),
                        "name": vuln.get("Title")
                        or vuln.get("VulnerabilityID", "unknown"),
                        "description": (vuln.get("Description") or "")[:4000],
                        "fixedVersion": vuln.get("FixedVersion") or "",
                        "severity": SEVERITY.get(vuln.get("Severity", ""), "Info"),
                        "pkgId": pkg_id,
                        "pkgName": vuln.get("PkgName", "unknown"),
                        "publishedAt": vuln.get("PublishedDate"),
                    }
                )

        client.upload_dependencies(scan_id, list(packages.values()), vulnerabilities)
        client.complete_scan(scan_id)
        return 0
    except Exception as exc:
        client.complete_scan(scan_id, str(exc))
        print(f"[trivy] failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
