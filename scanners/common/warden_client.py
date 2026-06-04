"""Minimal Warden CI client shared by the scanner images.

Implements the CI ingest contract of warden-api:
  POST /api/ci/scan         (CI-TOKEN header) -> { scanId, scanUrl, lastCommitSha }
  POST /api/ci/finding      { scanId, findings[], strategy }
  POST /api/ci/dependency   { scanId, packages[], vulnerabilities[] }
  PUT  /api/ci/scan/{id}    { status, description }
"""

import json
import os
import subprocess
import sys
import urllib.request


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None:
        print(f"[warden] missing required environment variable {name}", file=sys.stderr)
        sys.exit(2)
    return value


def git(*args: str, cwd: str) -> str | None:
    try:
        out = subprocess.run(
            ["git", *args], cwd=cwd, capture_output=True, text=True, timeout=10
        )
        return out.stdout.strip() or None
    except Exception:
        return None


class WardenClient:
    def __init__(self) -> None:
        self.base = env("WARDEN_URL", "http://warden:8080").rstrip("/")
        self.token = env("WARDEN_TOKEN")

    def _request(self, method: str, path: str, body: dict) -> dict | None:
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            f"{self.base}{path}",
            data=data,
            method=method,
            headers={"Content-Type": "application/json", "CI-TOKEN": self.token},
        )
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read()
            return json.loads(raw) if raw else None

    def create_scan(self, scanner: str, scanner_type: str, project_path: str) -> str:
        repo_name = os.environ.get("REPO_NAME") or os.path.basename(
            os.path.abspath(project_path)
        )
        branch = (
            os.environ.get("BRANCH")
            or git("rev-parse", "--abbrev-ref", "HEAD", cwd=project_path)
            or "main"
        )
        commit = (
            os.environ.get("COMMIT")
            or git("rev-parse", "HEAD", cwd=project_path)
            or "local"
        )
        title = (
            os.environ.get("SCAN_TITLE")
            or git("log", "-1", "--pretty=%s", cwd=project_path)
            or f"Local {scanner} scan"
        )
        body = {
            "source": "Local",
            "repoId": os.environ.get("REPO_ID") or repo_name,
            "repoUrl": os.environ.get("REPO_URL") or f"https://local/{repo_name}",
            "repoName": repo_name,
            "gitAction": "CommitBranch",
            "scanTitle": title,
            "commitBranch": branch,
            "commitHash": commit,
            "scanner": scanner,
            "type": scanner_type,
            "isDefault": os.environ.get("IS_DEFAULT", "true").lower() != "false",
        }
        info = self._request("POST", "/api/ci/scan", body)
        scan_id = info["scanId"]
        print(f"[warden] scan {scan_id} created for {repo_name}@{branch} ({commit[:12]})")
        return scan_id

    def upload_findings(self, scan_id: str, findings: list[dict]) -> None:
        self._request(
            "POST",
            "/api/ci/finding",
            {"scanId": scan_id, "findings": findings, "strategy": "AllFiles"},
        )
        print(f"[warden] uploaded {len(findings)} finding(s)")

    def upload_dependencies(
        self, scan_id: str, packages: list[dict], vulnerabilities: list[dict]
    ) -> None:
        self._request(
            "POST",
            "/api/ci/dependency",
            {
                "scanId": scan_id,
                "packages": packages,
                "vulnerabilities": vulnerabilities,
            },
        )
        print(
            f"[warden] uploaded {len(packages)} package(s), "
            f"{len(vulnerabilities)} vulnerability(ies)"
        )

    def complete_scan(self, scan_id: str, error: str | None = None) -> None:
        body = {"status": "Error", "description": error} if error else {"status": "Completed"}
        self._request("PUT", f"/api/ci/scan/{scan_id}", body)
        print(f"[warden] scan {scan_id} {'failed: ' + error if error else 'completed'}")
