//! cargo-audit (RustSec) SCA scanner for Techanv Warden.
//!
//! Audits a Rust project's Cargo.lock against the RustSec advisory database and
//! reports vulnerable crates to Warden through the SCA dependency contract. This
//! is Warden's first **Rust-native** scanner — it talks to the same HTTP+JSON CI
//! API as the Quarkus scanners (see `warden.rs`), demonstrating the contract is
//! language-agnostic.

mod warden;

use std::collections::BTreeMap;
use std::path::Path;
use std::process::Command;

use warden::{PackageInfo, VulnerabilityInfo, WardenClient};

fn main() -> std::process::ExitCode {
    match run() {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("[cargo-audit] failed: {e}");
            std::process::ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), String> {
    let project = std::env::var("PROJECT_PATH").unwrap_or_else(|_| "/src".to_string());
    let client = WardenClient::from_env()?;

    let scan_id = client
        .create_scan("cargo-audit", "Dependency", &project)
        .map_err(|e| format!("could not create scan: {e}"))?;

    // From here on, always close the scan — on success or with the error.
    let result = scan(&project);
    match &result {
        Ok((packages, vulns)) => {
            if let Err(e) = client.upload_dependencies(&scan_id, packages, vulns) {
                let _ = client.complete_scan(&scan_id, Some(&e));
                return Err(e);
            }
            client.complete_scan(&scan_id, None)?;
            Ok(())
        }
        Err(e) => {
            let _ = client.complete_scan(&scan_id, Some(e));
            Err(e.clone())
        }
    }
}

fn scan(project: &str) -> Result<(Vec<PackageInfo>, Vec<VulnerabilityInfo>), String> {
    let lockfile = Path::new(project).join("Cargo.lock");
    if !lockfile.exists() {
        println!("[cargo-audit] no Cargo.lock in {project}; nothing to audit");
        return Ok((Vec::new(), Vec::new()));
    }

    // cargo-audit is a cargo subcommand binary; invoked directly the first arg
    // is the subcommand name. --json prints the report to stdout. It exits 1
    // when advisories are found — that is a successful scan, not an error, so we
    // judge success by parseable JSON (like the semgrep/cve-lite wrappers).
    //
    // By default we use the advisory DB baked into the image (--no-fetch --stale)
    // so scans are deterministic and work in restricted networks. Set
    // CARGO_AUDIT_FETCH=true to git-pull the latest RustSec advisories first.
    let fetch = std::env::var("CARGO_AUDIT_FETCH")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let mut args: Vec<&str> = vec!["audit", "--json", "--file"];
    let lock_str = lockfile.to_string_lossy().to_string();
    args.push(&lock_str);
    if !fetch {
        args.push("--no-fetch");
        args.push("--stale");
    }
    println!("[cargo-audit] cargo-audit {}", args.join(" "));
    let out = Command::new("cargo-audit")
        .args(&args)
        .output()
        .map_err(|e| format!("spawn cargo-audit: {e}"))?;

    let stdout = String::from_utf8_lossy(&out.stdout);
    let report: serde_json::Value = serde_json::from_str(stdout.trim()).map_err(|e| {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let tail: String = stderr.chars().rev().take(500).collect::<String>().chars().rev().collect();
        format!("cargo-audit produced no JSON ({e}): {tail}")
    })?;

    let mut packages: BTreeMap<String, PackageInfo> = BTreeMap::new();
    let mut vulns: Vec<VulnerabilityInfo> = Vec::new();

    let list = report
        .pointer("/vulnerabilities/list")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    for entry in &list {
        let pkg = entry.get("package");
        let name = str_at(pkg, "name");
        let version = str_at(pkg, "version");
        let pkg_id = format!("pkg:cargo/{name}@{version}");
        packages.entry(pkg_id.clone()).or_insert_with(|| PackageInfo {
            pkg_id: pkg_id.clone(),
            name: name.clone(),
            version: version.clone(),
            r#type: "cargo".to_string(),
            location: Some("Cargo.lock".to_string()),
        });

        let advisory = entry.get("advisory");
        let rustsec_id = str_at(advisory, "id");
        let identity = cve_alias(advisory).unwrap_or_else(|| rustsec_id.clone());
        let title = str_at(advisory, "title");
        let mut description = str_at(advisory, "description");
        if description.len() > 4000 {
            description.truncate(4000);
        }
        if let Some(url) = advisory.and_then(|a| a.get("url")).and_then(|v| v.as_str()) {
            if !url.is_empty() {
                description = format!("{description}\n\n{rustsec_id} — {url}");
                if description.len() > 4000 {
                    description.truncate(4000);
                }
            }
        }

        vulns.push(VulnerabilityInfo {
            identity,
            name: if title.is_empty() { rustsec_id.clone() } else { title },
            description,
            fixed_version: patched_version(entry),
            severity: severity_of(advisory),
            pkg_id,
            pkg_name: name,
            published_at: advisory
                .and_then(|a| a.get("date"))
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string()),
        });
    }

    Ok((packages.into_values().collect(), vulns))
}

/// Prefer a CVE alias for the finding identity so it dedups against the other
/// SCA scanners; otherwise the RUSTSEC id.
fn cve_alias(advisory: Option<&serde_json::Value>) -> Option<String> {
    advisory
        .and_then(|a| a.get("aliases"))
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .find(|s| s.starts_with("CVE-"))
                .map(|s| s.to_string())
        })
}

/// RustSec `cvss` may be a numeric base score, a CVSS v3 vector, or null. Bucket
/// a numeric/vector score when we can; otherwise a curated RustSec advisory is a
/// real vulnerability, so default to High.
fn severity_of(advisory: Option<&serde_json::Value>) -> String {
    let cvss = advisory.and_then(|a| a.get("cvss"));
    if let Some(score) = cvss.and_then(|v| v.as_f64()) {
        return bucket(score);
    }
    if let Some(s) = cvss.and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        if let Ok(score) = s.parse::<f64>() {
            return bucket(score);
        }
        if let Some(score) = base_score_from_vector(s) {
            return bucket(score);
        }
    }
    "High".to_string()
}

fn bucket(score: f64) -> String {
    if score >= 9.0 {
        "Critical"
    } else if score >= 7.0 {
        "High"
    } else if score >= 4.0 {
        "Medium"
    } else if score > 0.0 {
        "Low"
    } else {
        "Info"
    }
    .to_string()
}

/// Minimal CVSS v3 base-score estimate from a vector string. Not a full CVSS
/// implementation — just enough to bucket; returns None if it can't parse the
/// core metrics, and the caller falls back to High.
fn base_score_from_vector(vector: &str) -> Option<f64> {
    if !vector.starts_with("CVSS:3") {
        return None;
    }
    let mut m: BTreeMap<&str, &str> = BTreeMap::new();
    for part in vector.split('/') {
        if let Some((k, v)) = part.split_once(':') {
            m.insert(k, v);
        }
    }
    let av = match *m.get("AV")? { "N" => 0.85, "A" => 0.62, "L" => 0.55, "P" => 0.2, _ => return None };
    let ac = match *m.get("AC")? { "L" => 0.77, "H" => 0.44, _ => return None };
    let pr = match (*m.get("PR")?, m.get("S").copied()) {
        ("N", _) => 0.85,
        ("L", Some("C")) => 0.68,
        ("L", _) => 0.62,
        ("H", Some("C")) => 0.50,
        ("H", _) => 0.27,
        _ => return None,
    };
    let ui = match *m.get("UI")? { "N" => 0.85, "R" => 0.62, _ => return None };
    let val = |k: &str| -> f64 { match *m.get(k).unwrap_or(&"N") { "H" => 0.56, "L" => 0.22, _ => 0.0 } };
    let (c, i, a): (f64, f64, f64) = (val("C"), val("I"), val("A"));
    let scope_changed = m.get("S").copied() == Some("C");

    let iss = 1.0 - (1.0 - c) * (1.0 - i) * (1.0 - a);
    let impact = if scope_changed {
        7.52 * (iss - 0.029) - 3.25 * (iss - 0.02).powf(15.0)
    } else {
        6.42 * iss
    };
    if impact <= 0.0 {
        return Some(0.0);
    }
    let exploitability = 8.22 * av * ac * pr * ui;
    let raw = if scope_changed {
        (1.08 * (impact + exploitability)).min(10.0)
    } else {
        (impact + exploitability).min(10.0)
    };
    // round up to one decimal (CVSS roundup)
    Some(((raw * 10.0).ceil()) / 10.0)
}

/// Extract a concrete version from the first `versions.patched` requirement
/// (e.g. ">= 0.14.10" -> "0.14.10").
fn patched_version(entry: &serde_json::Value) -> Option<String> {
    entry
        .pointer("/versions/patched")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.iter().filter_map(|v| v.as_str()).next())
        .map(|req| {
            req.trim_start_matches(|c: char| !c.is_ascii_digit())
                .to_string()
        })
        .filter(|s| !s.is_empty())
}

fn str_at(node: Option<&serde_json::Value>, key: &str) -> String {
    node.and_then(|n| n.get(key))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}
