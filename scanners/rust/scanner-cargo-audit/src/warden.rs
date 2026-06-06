//! Rust client for the Warden CI ingest contract — a direct port of the Java
//! `WardenClient`, proving the contract is plain HTTP+JSON and language-agnostic:
//!
//!   POST /api/ci/scan        (CI-TOKEN header) -> { scanId, scanUrl, lastCommitSha }
//!   POST /api/ci/dependency  { scanId, packages[], vulnerabilities[] }
//!   PUT  /api/ci/scan/{id}   { status, description? }

use std::time::Duration;

use serde::{Deserialize, Serialize};

/// A resolved dependency (mirrors the Java PackageInfo; nulls are omitted).
#[derive(Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackageInfo {
    pub pkg_id: String,
    pub name: String,
    pub version: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
}

/// A vulnerability affecting a package (mirrors the Java VulnerabilityInfo).
#[derive(Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VulnerabilityInfo {
    pub identity: String,
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fixed_version: Option<String>,
    pub severity: String,
    pub pkg_id: String,
    pub pkg_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub published_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CiScanRequest {
    source: String,
    repo_id: String,
    repo_url: String,
    repo_name: String,
    git_action: String,
    scan_title: String,
    commit_branch: String,
    commit_hash: String,
    scanner: String,
    r#type: String,
    is_default: bool,
}

#[derive(Deserialize)]
struct CiScanInfo {
    #[serde(rename = "scanId")]
    scan_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DependencyUpload<'a> {
    scan_id: &'a str,
    packages: &'a [PackageInfo],
    vulnerabilities: &'a [VulnerabilityInfo],
}

pub struct WardenClient {
    base: String,
    token: String,
    http: reqwest::blocking::Client,
}

impl WardenClient {
    /// Build from the standard scanner environment. Returns an error if
    /// WARDEN_TOKEN is unset (required), matching the Java client.
    pub fn from_env() -> Result<Self, String> {
        let base = env_or("WARDEN_URL", "http://warden:8080")
            .trim_end_matches('/')
            .to_string();
        let token = std::env::var("WARDEN_TOKEN")
            .map_err(|_| "WARDEN_TOKEN is required".to_string())?;
        let http = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| format!("http client: {e}"))?;
        Ok(Self { base, token, http })
    }

    /// POST /api/ci/scan — returns the scan id.
    pub fn create_scan(&self, scanner: &str, scanner_type: &str, project: &str) -> Result<String, String> {
        let repo_name = env_or("REPO_NAME", &basename(project));
        let branch = first_non_blank(&[
            std::env::var("BRANCH").ok(),
            git(project, &["rev-parse", "--abbrev-ref", "HEAD"]),
        ])
        .unwrap_or_else(|| "main".to_string());
        let commit = first_non_blank(&[
            std::env::var("COMMIT").ok(),
            git(project, &["rev-parse", "HEAD"]),
        ])
        .unwrap_or_else(|| "local".to_string());
        let title = first_non_blank(&[
            std::env::var("SCAN_TITLE").ok(),
            git(project, &["log", "-1", "--pretty=%s"]),
        ])
        .unwrap_or_else(|| format!("Local {scanner} scan"));

        let body = CiScanRequest {
            source: "Local".into(),
            repo_id: env_or("REPO_ID", &repo_name),
            repo_url: env_or("REPO_URL", &format!("https://local/{repo_name}")),
            repo_name: repo_name.clone(),
            git_action: "CommitBranch".into(),
            scan_title: title,
            commit_branch: branch.clone(),
            commit_hash: commit.clone(),
            scanner: scanner.into(),
            r#type: scanner_type.into(),
            is_default: !env_or("IS_DEFAULT", "true").eq_ignore_ascii_case("false"),
        };
        let info: CiScanInfo = self.send_json("POST", "/api/ci/scan", &body)?;
        let short = commit.chars().take(12).collect::<String>();
        println!("[warden] scan {} created for {repo_name}@{branch} ({short})", info.scan_id);
        Ok(info.scan_id)
    }

    /// POST /api/ci/dependency — upload resolved packages + their vulnerabilities.
    pub fn upload_dependencies(
        &self,
        scan_id: &str,
        packages: &[PackageInfo],
        vulnerabilities: &[VulnerabilityInfo],
    ) -> Result<(), String> {
        let body = DependencyUpload { scan_id, packages, vulnerabilities };
        self.send_empty("POST", "/api/ci/dependency", &body)?;
        println!(
            "[warden] uploaded {} package(s), {} vulnerability(ies)",
            packages.len(),
            vulnerabilities.len()
        );
        Ok(())
    }

    /// PUT /api/ci/scan/{id} — mark the scan Completed or Error.
    pub fn complete_scan(&self, scan_id: &str, error: Option<&str>) -> Result<(), String> {
        let body = match error {
            Some(e) => serde_json::json!({ "status": "Error", "description": e }),
            None => serde_json::json!({ "status": "Completed" }),
        };
        self.send_empty("PUT", &format!("/api/ci/scan/{scan_id}"), &body)?;
        match error {
            Some(e) => println!("[warden] scan {scan_id} failed: {e}"),
            None => println!("[warden] scan {scan_id} completed"),
        }
        Ok(())
    }

    fn send_json<T: serde::de::DeserializeOwned>(
        &self,
        method: &str,
        path: &str,
        body: &impl Serialize,
    ) -> Result<T, String> {
        let res = self.request(method, path, body)?;
        let status = res.status();
        let bytes = res.bytes().map_err(|e| format!("warden {path}: read body: {e}"))?;
        if !status.is_success() {
            return Err(format!("warden {path} -> HTTP {}", status.as_u16()));
        }
        serde_json::from_slice(&bytes).map_err(|e| format!("warden {path}: decode: {e}"))
    }

    fn send_empty(&self, method: &str, path: &str, body: &impl Serialize) -> Result<(), String> {
        let res = self.request(method, path, body)?;
        let status = res.status();
        if !status.is_success() {
            return Err(format!("warden {path} -> HTTP {}", status.as_u16()));
        }
        Ok(())
    }

    fn request(
        &self,
        method: &str,
        path: &str,
        body: &impl Serialize,
    ) -> Result<reqwest::blocking::Response, String> {
        let url = format!("{}{path}", self.base);
        let m = reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| e.to_string())?;
        self.http
            .request(m, &url)
            .header("Content-Type", "application/json")
            .header("CI-TOKEN", &self.token)
            .json(body)
            .send()
            .map_err(|e| format!("warden {path}: {e}"))
    }
}

fn env_or(name: &str, default: &str) -> String {
    match std::env::var(name) {
        Ok(v) if !v.is_empty() => v,
        _ => default.to_string(),
    }
}

fn first_non_blank(values: &[Option<String>]) -> Option<String> {
    values
        .iter()
        .flatten()
        .find(|v| !v.trim().is_empty())
        .map(|v| v.trim().to_string())
}

fn basename(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(path)
        .to_string()
}

/// Best-effort `git -C <project> <args>`; None on any failure.
fn git(project: &str, args: &[&str]) -> Option<String> {
    let out = std::process::Command::new("git")
        .arg("-C")
        .arg(project)
        .args(args)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}
