"""Source-control context for CI scans — GitHub Actions and GitLab CI.

Ported from the upstream Go analyzer (califio/code-secure-analyzer): detects
the merge-/pull-request context from CI environment variables and posts new
findings as inline review comments on the changed lines, giving developers
shift-left feedback directly on the merge request.

Pure standard library (urllib) so the scanner images need no extra packages.
All network calls are best-effort: a failure here never fails the scan.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def _log(msg: str) -> None:
    print(f"[warden] {msg}", file=sys.stderr)


def _http(method: str, url: str, token_header: tuple[str, str], body: dict | None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", token_header[0]: token_header[1]}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:  # noqa: PERF203
        return e.code, None
    except Exception as e:  # network / parse — stay quiet, never break the scan
        _log(f"source-control request failed: {e}")
        return None, None


class SourceManager:
    """Base class. Subclasses fill in provider specifics."""

    provider = "local"

    def is_merge_request(self) -> bool:
        return bool(self.merge_request_id())

    # --- context (overridden) -------------------------------------------------
    def merge_request_id(self) -> str | None:
        return None

    def target_branch(self) -> str | None:
        return None

    def commit_sha(self) -> str | None:
        return None

    def blob_url(self) -> str:
        return ""

    # --- posting (overridden) -------------------------------------------------
    def create_review_comment(self, path: str, start_line: int, end_line: int, title: str, body: str) -> bool:
        return False


class GitHubSourceManager(SourceManager):
    provider = "GitHub"

    def __init__(self) -> None:
        self.token = os.environ.get("GITHUB_TOKEN") or ""
        self.api = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
        self.server = os.environ.get("GITHUB_SERVER_URL", "https://github.com").rstrip("/")
        self.repository = os.environ.get("GITHUB_REPOSITORY", "")  # owner/repo
        self._pr = self._detect_pr()

    @staticmethod
    def active() -> bool:
        return os.environ.get("GITHUB_ACTIONS", "").lower() == "true"

    def _detect_pr(self) -> str | None:
        ref = os.environ.get("GITHUB_REF", "")
        if ref.startswith("refs/pull/"):
            return ref.split("/")[2]
        path = os.environ.get("GITHUB_EVENT_PATH")
        if path and os.path.exists(path):
            try:
                with open(path) as f:
                    payload = json.load(f)
                pr = payload.get("pull_request") or {}
                number = pr.get("number") or payload.get("number")
                return str(number) if number else None
            except Exception:
                return None
        return None

    def merge_request_id(self) -> str | None:
        return self._pr

    def target_branch(self) -> str | None:
        return os.environ.get("GITHUB_BASE_REF") or None

    def commit_sha(self) -> str | None:
        return os.environ.get("GITHUB_SHA") or None

    def blob_url(self) -> str:
        return f"{self.server}/{self.repository}/blob"

    def create_review_comment(self, path: str, start_line: int, end_line: int, title: str, body: str) -> bool:
        if not (self.token and self._pr and "/" in self.repository):
            return False
        owner, repo = self.repository.split("/", 1)
        comment: dict = {"path": path, "body": body, "side": "RIGHT"}
        if start_line and end_line and end_line > start_line:
            comment["start_line"] = start_line
            comment["line"] = end_line
        else:
            comment["line"] = start_line or 1
        review = {"body": title, "event": "COMMENT", "comments": [comment]}
        url = f"{self.api}/repos/{owner}/{repo}/pulls/{self._pr}/reviews"
        status, _ = _http("POST", url, ("Authorization", f"Bearer {self.token}"), review)
        return status is not None and 200 <= status < 300


class GitLabSourceManager(SourceManager):
    provider = "GitLab"

    def __init__(self) -> None:
        self.token = os.environ.get("GITLAB_TOKEN") or os.environ.get("CI_JOB_TOKEN") or ""
        self.api = os.environ.get("CI_API_V4_URL", "https://gitlab.com/api/v4").rstrip("/")
        self.project_id = os.environ.get("CI_PROJECT_ID", "")
        self.project_url = os.environ.get("CI_PROJECT_URL", "")
        self._iid = os.environ.get("CI_MERGE_REQUEST_IID") or None
        self._diff_refs: dict | None = None

    @staticmethod
    def active() -> bool:
        return os.environ.get("GITLAB_CI", "").lower() == "true"

    def merge_request_id(self) -> str | None:
        return self._iid

    def target_branch(self) -> str | None:
        return os.environ.get("CI_MERGE_REQUEST_TARGET_BRANCH_NAME") or None

    def commit_sha(self) -> str | None:
        return os.environ.get("CI_COMMIT_SHA") or None

    def blob_url(self) -> str:
        return f"{self.project_url}/-/blob"

    def _refs(self) -> dict | None:
        if self._diff_refs is None and self.token and self._iid:
            url = f"{self.api}/projects/{self.project_id}/merge_requests/{self._iid}"
            _, mr = _http("GET", url, ("PRIVATE-TOKEN", self.token), None)
            self._diff_refs = (mr or {}).get("diff_refs") or {}
        return self._diff_refs

    def create_review_comment(self, path: str, start_line: int, end_line: int, title: str, body: str) -> bool:
        if not (self.token and self._iid):
            return False
        refs = self._refs() or {}
        position = {
            "position_type": "text",
            "base_sha": refs.get("base_sha"),
            "start_sha": refs.get("start_sha"),
            "head_sha": refs.get("head_sha"),
            "new_path": path,
            "old_path": path,
            "new_line": start_line or 1,
        }
        url = f"{self.api}/projects/{self.project_id}/merge_requests/{self._iid}/discussions"
        payload = {"body": body, "position": position}
        status, _ = _http("POST", url, ("PRIVATE-TOKEN", self.token), payload)
        if status == 400:  # new_line not on the diff — retry as a plain MR note
            note_url = f"{self.api}/projects/{self.project_id}/merge_requests/{self._iid}/notes"
            status, _ = _http("POST", note_url, ("PRIVATE-TOKEN", self.token), {"body": f"**{title}**\n\n{body}"})
        return status is not None and 200 <= status < 300


def detect() -> SourceManager:
    """Return the active source manager for this CI environment."""
    if GitHubSourceManager.active():
        return GitHubSourceManager()
    if GitLabSourceManager.active():
        return GitLabSourceManager()
    return SourceManager()


def comment_message(finding: dict, blob_url: str, commit_sha: str, finding_url: str) -> str:
    """Render the markdown body posted for a new finding (mirrors upstream)."""
    loc = finding.get("location") or {}
    path = loc.get("path", "")
    snippet = loc.get("snippet", "")
    start = loc.get("startLine", 0)
    detail = f"{finding_url.rstrip('/')}/#/finding/{finding.get('id', '')}" if finding.get("id") else finding_url
    location_url = f"{blob_url}/{commit_sha}/{path}#L{start}" if path and commit_sha else ""
    name = finding.get("name", "Finding")
    msg = f"**[{name}]({detail})**\n\n"
    if path:
        loc_line = f"`{snippet}` @ [{path}]({location_url})" if location_url else f"`{path}`"
        msg += f"**Location:** {loc_line}\n\n"
    if finding.get("description"):
        msg += f"**Description**\n\n{finding['description']}\n\n"
    if finding.get("recommendation"):
        msg += f"**Recommendation**\n\n{finding['recommendation']}\n"
    return msg.strip()


def post_new_findings(
    source: SourceManager, new_findings: list[dict], finding_url: str
) -> int:
    """Post each new finding as an inline review comment. Returns count posted."""
    if not source.is_merge_request() or not new_findings:
        return 0
    blob = source.blob_url()
    sha = source.commit_sha() or ""
    posted = 0
    for finding in new_findings:
        loc = finding.get("location") or {}
        path = loc.get("path")
        if not path:
            continue
        body = comment_message(finding, blob, sha, finding_url)
        ok = source.create_review_comment(
            path=path,
            start_line=int(loc.get("startLine") or 0),
            end_line=int(loc.get("endLine") or 0),
            title=finding.get("name", "Finding"),
            body=body,
        )
        if ok:
            posted += 1
    if posted:
        _log(f"posted {posted} finding comment(s) on {source.provider} merge request")
    return posted
