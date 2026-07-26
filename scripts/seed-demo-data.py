#!/usr/bin/env python3
"""Seed a full demo dataset so every console surface has data to show.

Creates projects, SAST/Secret/Container/Cloud findings, SCA packages+vulns,
status triage (Confirmed / Fixed / AcceptedRisk), and comments.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any

API = "http://127.0.0.1:5272"
USER = "system"
PASSWORD = "ChangeMe_L0cal!"


def req(
    method: str,
    path: str,
    body: dict | list | None = None,
    *,
    token: str | None = None,
    ci_token: str | None = None,
) -> Any:
    data = None if body is None else json.dumps(body).encode()
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if ci_token:
        headers["CI-TOKEN"] = ci_token
    r = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=90) as res:
            raw = res.read()
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        err = e.read().decode(errors="replace")
        raise SystemExit(f"{method} {path} -> {e.code}: {err[:500]}") from e


def main() -> None:
    login = req("POST", "/api/login", {"userName": USER, "password": PASSWORD})
    jwt = login["accessToken"]
    print("✓ logged in as system")

    tokens = req("GET", "/api/token", token=jwt) or []
    ci = next((t for t in tokens if t.get("name") == "demo-seed"), None)
    if not ci or not ci.get("value"):
        ci = req("POST", "/api/token", {"name": "demo-seed"}, token=jwt)
    ci_token = ci["value"]
    print(f"✓ CI token ready")

    projects = [
        {
            "repoId": "demo-payments",
            "repoName": "payments-api",
            "repoUrl": "https://github.com/demo/payments-api",
            "source": "GitHub",
            "lang": "java",
        },
        {
            "repoId": "demo-portal",
            "repoName": "customer-portal",
            "repoUrl": "https://gitlab.com/demo/customer-portal",
            "source": "GitLab",
            "lang": "ts",
        },
        {
            "repoId": "demo-edge",
            "repoName": "edge-gateway",
            "repoUrl": "https://github.com/demo/edge-gateway",
            "source": "GitHub",
            "lang": "go",
        },
        {
            "repoId": "demo-auth",
            "repoName": "auth-service",
            "repoUrl": "https://github.com/demo/auth-service",
            "source": "GitHub",
            "lang": "java",
        },
        {
            "repoId": "demo-mobile",
            "repoName": "mobile-bff",
            "repoUrl": "https://github.com/demo/mobile-bff",
            "source": "GitHub",
            "lang": "ts",
        },
        {
            "repoId": "demo-data",
            "repoName": "data-pipeline",
            "repoUrl": "https://gitlab.com/demo/data-pipeline",
            "source": "GitLab",
            "lang": "python",
        },
        {
            "repoId": "demo-infra",
            "repoName": "platform-iac",
            "repoUrl": "https://github.com/demo/platform-iac",
            "source": "GitHub",
            "lang": "iac",
        },
        {
            "repoId": "demo-ml",
            "repoName": "ml-inference",
            "repoUrl": "https://github.com/demo/ml-inference",
            "source": "GitHub",
            "lang": "python",
        },
    ]

    sast_catalog = [
        ("Critical", "java.spring.security.ssrf", "Server-side request forgery", "src/main/java/com/demo/HttpClient.java", 42),
        ("Critical", "java.spring.security.sqli", "SQL injection in repository query", "src/main/java/com/demo/OrderRepo.java", 118),
        ("High", "javascript.express.security.xss", "Reflected XSS in search", "src/routes/search.ts", 88),
        ("High", "javascript.lang.security.path-traversal", "Path traversal in download", "src/handlers/files.ts", 67),
        ("High", "python.django.security.sqli", "SQL injection via raw filter", "apps/billing/views.py", 156),
        ("High", "go.lang.security.command-injection", "Command injection in shell helper", "internal/exec/run.go", 33),
        ("Medium", "go.lang.security.insecure-tls", "Insecure TLS min version", "internal/http/client.go", 31),
        ("Medium", "java.spring.security.csrf-disabled", "CSRF protection disabled", "src/main/java/com/demo/SecurityConfig.java", 55),
        ("Medium", "dockerfile.security.missing-user", "Container runs as root", "Dockerfile", 24),
        ("Medium", "terraform.aws.security.open-sg", "Security group open to 0.0.0.0/0", "infra/sg.tf", 19),
        ("Low", "java.lang.security.printstacktrace", "Active debug stack traces", "src/main/java/com/demo/Errors.java", 19),
        ("Low", "javascript.lang.security.eval", "Use of eval()", "src/utils/dyn.ts", 14),
        ("Info", "generic.info.todo-security", "Security TODO left in prod path", "src/middleware/auth.ts", 12),
        ("Info", "generic.info.http-no-https", "HTTP endpoint without TLS note", "docs/api.md", 8),
        ("Critical", "python.flask.security.ssti", "Server-side template injection", "app/templates/render.py", 47),
        ("High", "java.spring.security.xxe", "XML external entity (XXE)", "src/main/java/com/demo/XmlParse.java", 73),
    ]

    secret_catalog = [
        ("Critical", "aws-access-key", "AWS Access Key ID detected", ".env.example", 3),
        ("Critical", "private-key", "Private key material", "config/keys/dev.pem", 1),
        ("High", "generic-api-key", "Generic API key pattern", "deploy/values.yaml", 44),
        ("High", "slack-token", "Slack bot token", "scripts/notify.sh", 9),
        ("Medium", "github-pat", "GitHub personal access token", "ci/secrets.env", 2),
    ]

    container_catalog = [
        ("Critical", "cve-container-rce", "Base image RCE CVE", "Dockerfile", 1),
        ("High", "cve-openssl", "OpenSSL vulnerability in image", "Dockerfile", 1),
        ("Medium", "image-outdated-tag", "Floating :latest tag", "Dockerfile", 1),
        ("Low", "image-no-healthcheck", "Missing HEALTHCHECK", "Dockerfile", 1),
    ]

    cloud_catalog = [
        ("Critical", "aws.s3.public-bucket", "S3 bucket publicly readable", "infra/s3.tf", 22),
        ("High", "aws.iam.wildcard-action", "IAM policy Action=*", "infra/iam.tf", 40),
        ("Medium", "k8s.security.privileged", "Privileged pod security context", "k8s/deploy.yaml", 61),
        ("Low", "k8s.security.no-limits", "Missing resource limits", "k8s/deploy.yaml", 78),
    ]

    sca_packages = [
        ("pkg:maven/org.springframework/spring-webmvc@5.3.9", "org.springframework", "spring-webmvc", "5.3.9", "pom"),
        ("pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1", "org.apache.logging.log4j", "log4j-core", "2.14.1", "pom"),
        ("pkg:golang/golang.org/x/net@0.15.0", "golang.org/x", "net", "0.15.0", "go"),
        ("pkg:maven/org.springframework/spring-web@6.0.10", "org.springframework", "spring-web", "6.0.10", "pom"),
        ("pkg:npm/lodash@4.17.20", None, "lodash", "4.17.20", "npm"),
        ("pkg:pypi/django@3.2.12", None, "django", "3.2.12", "pypi"),
        ("pkg:npm/axios@0.21.1", None, "axios", "0.21.1", "npm"),
        ("pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.12.3", "com.fasterxml.jackson.core", "jackson-databind", "2.12.3", "pom"),
    ]

    sca_vulns = [
        ("CVE-2022-22965", "Critical", "pkg:maven/org.springframework/spring-webmvc@5.3.9", "org.springframework:spring-webmvc", "5.3.18", "Spring4Shell RCE"),
        ("CVE-2021-44228", "Critical", "pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1", "org.apache.logging.log4j:log4j-core", "2.17.1", "Log4Shell RCE"),
        ("CVE-2023-44487", "High", "pkg:golang/golang.org/x/net@0.15.0", "golang.org/x/net", "0.17.0", "HTTP/2 Rapid Reset DoS"),
        ("CVE-2024-22243", "Medium", "pkg:maven/org.springframework/spring-web@6.0.10", "org.springframework:spring-web", "6.1.4", "URL parsing open redirect/SSRF"),
        ("CVE-2021-23337", "High", "pkg:npm/lodash@4.17.20", "lodash", "4.17.21", "Command injection via template"),
        ("CVE-2022-34265", "High", "pkg:pypi/django@3.2.12", "django", "3.2.14", "SQL injection in Trunc/Extract"),
        ("CVE-2021-3749", "Medium", "pkg:npm/axios@0.21.1", "axios", "0.21.2", "SSRF via absolute URL"),
        ("CVE-2020-36518", "High", "pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.12.3", "jackson-databind", "2.12.6", "DoS via deeply nested objects"),
    ]

    totals = {"sast": 0, "secret": 0, "container": 0, "cloud": 0, "sca": 0, "triaged": 0, "comments": 0}

    for pi, proj in enumerate(projects):
        # ---- SAST ----
        scan = req(
            "POST",
            "/api/ci/scan",
            {
                "source": proj["source"],
                "repoId": proj["repoId"],
                "repoUrl": proj["repoUrl"],
                "repoName": proj["repoName"],
                "gitAction": "MergeRequest",
                "scanTitle": f"semgrep · {proj['repoName']} · MR",
                "commitBranch": "feature/demo-hardening",
                "commitHash": f"a1b2c3d4e5f6{pi:04d}cafe",
                "targetBranch": "main",
                "mergeRequestId": str(100 + pi),
                "scanner": "semgrep",
                "type": "Sast",
                "jobUrl": f"https://ci.example.com/jobs/sast/{1000 + pi}",
                "isDefault": True,
            },
            ci_token=ci_token,
        )
        # pick a rotating slice of findings per project (10–14)
        offset = (pi * 3) % len(sast_catalog)
        chosen = (sast_catalog[offset:] + sast_catalog[:offset])[: 10 + (pi % 5)]
        findings = []
        for fi, (sev, rule, name, path, line) in enumerate(chosen):
            findings.append(
                {
                    "ruleId": rule,
                    "identity": f"{rule}::{proj['repoId']}::{fi}",
                    "name": name,
                    "description": f"{name}. Demo finding for {proj['repoName']}.",
                    "recommendation": "Follow rule guidance, add regression test, re-scan main.",
                    "severity": sev,
                    "location": {"path": path, "snippet": "user_input", "startLine": line + fi},
                    "metadata": {"references": [f"https://semgrep.dev/r?q={rule}"]},
                }
            )
        req("POST", "/api/ci/finding", {"scanId": scan["scanId"], "findings": findings}, ci_token=ci_token)
        req("PUT", f"/api/ci/scan/{scan['scanId']}", {"status": "Completed"}, ci_token=ci_token)
        totals["sast"] += len(findings)

        # ---- Secrets ----
        scan_s = req(
            "POST",
            "/api/ci/scan",
            {
                "source": proj["source"],
                "repoId": proj["repoId"],
                "repoUrl": proj["repoUrl"],
                "repoName": proj["repoName"],
                "gitAction": "CommitBranch",
                "scanTitle": f"gitleaks · {proj['repoName']}",
                "commitBranch": "main",
                "commitHash": f"b2c3d4e5f6a7{pi:04d}beef",
                "scanner": "gitleaks",
                "type": "Secret",
                "jobUrl": f"https://ci.example.com/jobs/secret/{2000 + pi}",
                "isDefault": True,
            },
            ci_token=ci_token,
        )
        secrets = []
        for fi, (sev, rule, name, path, line) in enumerate(secret_catalog[: 3 + (pi % 3)]):
            secrets.append(
                {
                    "ruleId": rule,
                    "identity": f"{rule}::{proj['repoId']}::{fi}",
                    "name": name,
                    "description": f"{name} in {proj['repoName']}",
                    "severity": sev,
                    "location": {"path": path, "snippet": "***REDACTED***", "startLine": line},
                    "metadata": {"references": ["https://gitleaks.io"]},
                }
            )
        req("POST", "/api/ci/finding", {"scanId": scan_s["scanId"], "findings": secrets}, ci_token=ci_token)
        req("PUT", f"/api/ci/scan/{scan_s['scanId']}", {"status": "Completed"}, ci_token=ci_token)
        totals["secret"] += len(secrets)

        # ---- Container ----
        scan_c = req(
            "POST",
            "/api/ci/scan",
            {
                "source": proj["source"],
                "repoId": proj["repoId"],
                "repoUrl": proj["repoUrl"],
                "repoName": proj["repoName"],
                "gitAction": "CommitBranch",
                "scanTitle": f"trivy image · {proj['repoName']}",
                "commitBranch": "main",
                "commitHash": f"c3d4e5f6a7b8{pi:04d}face",
                "scanner": "trivy-image",
                "type": "Container",
                "jobUrl": f"https://ci.example.com/jobs/image/{4000 + pi}",
                "isDefault": True,
                "containerImage": f"ghcr.io/demo/{proj['repoName']}:1.{pi}.0",
            },
            ci_token=ci_token,
        )
        cont = []
        for fi, (sev, rule, name, path, line) in enumerate(container_catalog):
            cont.append(
                {
                    "ruleId": rule,
                    "identity": f"{rule}::{proj['repoId']}::{fi}",
                    "name": name,
                    "description": f"{name} for image ghcr.io/demo/{proj['repoName']}",
                    "severity": sev,
                    "location": {"path": path, "snippet": "FROM alpine:3.14", "startLine": line},
                    "metadata": {},
                }
            )
        req("POST", "/api/ci/finding", {"scanId": scan_c["scanId"], "findings": cont}, ci_token=ci_token)
        req("PUT", f"/api/ci/scan/{scan_c['scanId']}", {"status": "Completed"}, ci_token=ci_token)
        totals["container"] += len(cont)

        # ---- Cloud / IaC (every other project) ----
        if pi % 2 == 0:
            scan_k = req(
                "POST",
                "/api/ci/scan",
                {
                    "source": proj["source"],
                    "repoId": proj["repoId"],
                    "repoUrl": proj["repoUrl"],
                    "repoName": proj["repoName"],
                    "gitAction": "CommitBranch",
                    "scanTitle": f"checkov · {proj['repoName']}",
                    "commitBranch": "main",
                    "commitHash": f"d4e5f6a7b8c9{pi:04d}abad",
                    "scanner": "checkov",
                    "type": "Cloud",
                    "jobUrl": f"https://ci.example.com/jobs/cloud/{5000 + pi}",
                    "isDefault": True,
                },
                ci_token=ci_token,
            )
            cloud = []
            for fi, (sev, rule, name, path, line) in enumerate(cloud_catalog):
                cloud.append(
                    {
                        "ruleId": rule,
                        "identity": f"{rule}::{proj['repoId']}::{fi}",
                        "name": name,
                        "description": name,
                        "severity": sev,
                        "location": {"path": path, "snippet": "resource", "startLine": line},
                        "metadata": {},
                    }
                )
            req("POST", "/api/ci/finding", {"scanId": scan_k["scanId"], "findings": cloud}, ci_token=ci_token)
            req("PUT", f"/api/ci/scan/{scan_k['scanId']}", {"status": "Completed"}, ci_token=ci_token)
            totals["cloud"] += len(cloud)

        # ---- SCA ----
        scan_d = req(
            "POST",
            "/api/ci/scan",
            {
                "source": proj["source"],
                "repoId": proj["repoId"],
                "repoUrl": proj["repoUrl"],
                "repoName": proj["repoName"],
                "gitAction": "CommitBranch",
                "scanTitle": f"trivy SCA · {proj['repoName']}",
                "commitBranch": "main",
                "commitHash": f"e5f6a7b8c9d0{pi:04d}dead",
                "scanner": "trivy",
                "type": "Dependency",
                "jobUrl": f"https://ci.example.com/jobs/sca/{3000 + pi}",
                "isDefault": True,
            },
            ci_token=ci_token,
        )
        # rotate packages/vulns per project
        pkgs = sca_packages[pi % 3 :] + sca_packages[: pi % 3]
        vulns_src = sca_vulns[pi % 2 :] + sca_vulns[: pi % 2]
        packages = []
        for pkg_id, group, name, ver, typ in pkgs:
            packages.append(
                {
                    "pkgId": pkg_id,
                    "group": group,
                    "name": name,
                    "version": ver,
                    "type": typ,
                    "location": "pom.xml" if typ == "pom" else ("go.mod" if typ == "go" else "package.json"),
                }
            )
        vulns = []
        for cve, sev, pkg_id, pkg_name, fixed, desc in vulns_src:
            vulns.append(
                {
                    "identity": f"{cve}::{proj['repoId']}",
                    "name": cve,
                    "description": desc,
                    "fixedVersion": fixed,
                    "severity": sev,
                    "pkgId": pkg_id,
                    "pkgName": pkg_name,
                    "metadata": {},
                }
            )
        req(
            "POST",
            "/api/ci/dependency",
            {
                "scanId": scan_d["scanId"],
                "packages": packages,
                "packageDependencies": [
                    {
                        "pkgId": packages[0]["pkgId"],
                        "dependencies": [packages[min(1, len(packages) - 1)]["pkgId"]],
                    }
                ],
                "vulnerabilities": vulns,
            },
            ci_token=ci_token,
        )
        req("PUT", f"/api/ci/scan/{scan_d['scanId']}", {"status": "Completed"}, ci_token=ci_token)
        totals["sca"] += len(vulns)
        print(f"✓ {proj['repoName']}: sast={len(findings)} secret={len(secrets)} container={len(cont)} sca={len(vulns)}")

    # ---- Triage a slice of findings for pipeline / status charts ----
    page = req("POST", "/api/finding/filter", {"page": 1, "size": 100, "desc": True}, token=jwt)
    items = page.get("items") or []
    for i, f in enumerate(items):
        fid = f.get("id")
        if not fid:
            continue
        # cycle statuses for demo richness
        if i % 7 == 0:
            status = "Confirmed"
        elif i % 7 == 1:
            status = "Fixed"
        elif i % 7 == 2:
            status = "AcceptedRisk"
        elif i % 7 == 3:
            status = "Incorrect"
        else:
            status = None
        if status:
            req("PATCH", f"/api/finding/{fid}", {"status": status}, token=jwt)
            totals["triaged"] += 1
        if i % 5 == 0:
            try:
                req(
                    "POST",
                    f"/api/finding/{fid}/comment",
                    {"comment": f"Demo triage note: reviewing {f.get('name') or 'finding'} for sprint demo."},
                    token=jwt,
                )
                totals["comments"] += 1
            except SystemExit:
                pass  # comment endpoint shape may vary

    projects_page = req("POST", "/api/project/filter", {"page": 1, "size": 50}, token=jwt)
    findings_page = req("POST", "/api/finding/filter", {"page": 1, "size": 5}, token=jwt)

    print()
    print("── seed complete ──")
    print(f"projects:     {projects_page.get('count')}")
    print(f"findings:     {findings_page.get('count')}")
    print(f"ingested:     sast={totals['sast']} secret={totals['secret']} container={totals['container']} cloud={totals['cloud']} sca={totals['sca']}")
    print(f"triaged:      {totals['triaged']}  comments: {totals['comments']}")
    print()
    print("Open http://localhost:8081/dashboard  (Ctrl+Shift+R)")
    print("Login: system / ChangeMe_L0cal!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
