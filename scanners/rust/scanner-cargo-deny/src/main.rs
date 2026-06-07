//! cargo-deny (EmbarkStudios) scanner for Techanv Warden.
//!
//! cargo-deny lints a Rust project for security advisories (RustSec), OSS
//! license policy, and banned/duplicate crates. Unlike cargo-audit (advisories
//! only), it closes the **license-compliance** gap. This is a Rust-native
//! scanner using the shared `warden.rs` HTTP client; results ingest as findings.

mod warden;

use std::collections::HashSet;
use std::path::Path;
use std::process::Command;

use warden::{Finding, FindingLocation, WardenClient};

fn main() -> std::process::ExitCode {
    match run() {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("[cargo-deny] failed: {e}");
            std::process::ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), String> {
    let project = std::env::var("PROJECT_PATH").unwrap_or_else(|_| "/src".to_string());
    let client = WardenClient::from_env()?;
    let scan_id = client
        .create_scan("cargo-deny", "Dependency", &project)
        .map_err(|e| format!("could not create scan: {e}"))?;

    match scan(&project) {
        Ok(findings) => {
            if let Err(e) = client.upload_findings(&scan_id, &findings) {
                let _ = client.complete_scan(&scan_id, Some(&e));
                return Err(e);
            }
            client.complete_scan(&scan_id, None)
        }
        Err(e) => {
            let _ = client.complete_scan(&scan_id, Some(&e));
            Err(e)
        }
    }
}

fn scan(project: &str) -> Result<Vec<Finding>, String> {
    if !Path::new(project).join("Cargo.toml").exists() {
        println!("[cargo-deny] no Cargo.toml in {project}; nothing to check");
        return Ok(Vec::new());
    }

    // License policy lives in the project's deny.toml. With one present, run the
    // full check (respecting their allow/deny lists); without it, license checks
    // would flag every crate as "not explicitly allowed" (pure noise), so run
    // only advisories + bans. Override with CARGO_DENY_CHECKS (e.g. "advisories").
    let has_config = Path::new(project).join("deny.toml").exists();
    let checks = std::env::var("CARGO_DENY_CHECKS").unwrap_or_else(|_| {
        if has_config { String::new() } else { "advisories bans".to_string() }
    });

    // Invoke the cargo-deny binary directly (no cargo driver needed at runtime).
    // --format json is a global flag before the check subcommand.
    let mut args: Vec<String> = vec!["--format".into(), "json".into(), "check".into()];
    for c in checks.split_whitespace() {
        args.push(c.to_string());
    }

    println!("[cargo-deny] cargo-deny {}", args.join(" "));
    let out = Command::new("cargo-deny")
        .args(&args)
        .current_dir(project)
        .output()
        .map_err(|e| format!("spawn cargo-deny: {e}"))?;

    // --format json emits one JSON log record per line on stderr; diagnostics
    // are records whose `type` == "diagnostic". cargo-deny exits non-zero when
    // it finds problems — that is a successful scan, judged by parseable output.
    let stderr = String::from_utf8_lossy(&out.stderr);
    let mut findings = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut any_json = false;
    for line in stderr.lines() {
        let line = line.trim();
        if line.is_empty() || !line.starts_with('{') {
            continue;
        }
        let rec: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        any_json = true;
        if rec.get("type").and_then(|v| v.as_str()) != Some("diagnostic") {
            continue;
        }
        let f = &rec["fields"];
        let severity_raw = f.get("severity").and_then(|v| v.as_str()).unwrap_or("warning");
        // Skip pure notes/help — keep errors and warnings (actual policy hits).
        if severity_raw == "note" || severity_raw == "help" {
            continue;
        }
        let code = f
            .get("code")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .unwrap_or("cargo-deny")
            .to_string();
        let message = f.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let (crate_name, crate_version) = crate_of(f);
        let crate_ref = match (&crate_name, &crate_version) {
            (Some(n), Some(v)) => format!("{n}@{v}"),
            (Some(n), None) => n.clone(),
            _ => String::new(),
        };

        // For advisory diagnostics, identify by the advisory's CVE alias (else
        // RUSTSEC id) so it dedups against cargo-audit and the other SCA
        // scanners. Otherwise key by the diagnostic code + crate.
        let advisory = f.get("advisory");
        let identity = if let Some(adv_id) = advisory_id(advisory) {
            adv_id
        } else if crate_ref.is_empty() {
            format!("cargo-deny:{code}:{}", short_hash(&message))
        } else {
            format!("cargo-deny:{code}:{crate_ref}")
        };
        if !seen.insert(identity.clone()) {
            continue;
        }

        findings.push(Finding {
            identity,
            rule_id: Some(code.clone()),
            name: if message.is_empty() { code.clone() } else { truncate(&message, 200) },
            description: describe(f, &message, &crate_ref),
            category: Some(category_for(&code)),
            severity: severity_of(severity_raw),
            location: Some(FindingLocation {
                path: Some(if crate_ref.is_empty() { "Cargo.toml".into() } else { format!("Cargo.toml · {crate_ref}") }),
                ..Default::default()
            }),
        });
    }

    if findings.is_empty() && !any_json {
        let tail: String = stderr.chars().rev().take(500).collect::<String>().chars().rev().collect();
        // No diagnostics AND no JSON at all → cargo-deny didn't run.
        if !out.status.success() && tail.contains("error") && !tail.contains("advisories") {
            return Err(format!("cargo-deny did not run: {tail}"));
        }
    }
    Ok(findings)
}

/// Extract the offending crate from a diagnostic's `graphs[0].Krate` (the
/// dependency-graph root cargo-deny attaches to each diagnostic).
fn crate_of(fields: &serde_json::Value) -> (Option<String>, Option<String>) {
    if let Some(k) = fields
        .get("graphs")
        .and_then(|v| v.as_array())
        .and_then(|a| a.first())
        .and_then(|g| g.get("Krate"))
    {
        let name = k.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
        let version = k.get("version").and_then(|v| v.as_str()).map(|s| s.to_string());
        if name.is_some() {
            return (name, version);
        }
    }
    (None, None)
}

/// The advisory's CVE alias (preferred for cross-scanner dedup) or its RUSTSEC id.
fn advisory_id(advisory: Option<&serde_json::Value>) -> Option<String> {
    let adv = advisory?;
    if let Some(cve) = adv
        .get("aliases")
        .and_then(|v| v.as_array())
        .and_then(|a| a.iter().filter_map(|x| x.as_str()).find(|s| s.starts_with("CVE-")))
    {
        return Some(cve.to_string());
    }
    adv.get("id").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(|s| s.to_string())
}

fn describe(fields: &serde_json::Value, message: &str, crate_ref: &str) -> String {
    let mut s = message.to_string();
    if !crate_ref.is_empty() {
        s = format!("{s}\n\nCrate: {crate_ref}");
    }
    for label in fields.get("labels").and_then(|v| v.as_array()).into_iter().flatten() {
        if let Some(t) = label.get("message").and_then(|v| v.as_str()).filter(|t| !t.is_empty()) {
            s = format!("{s}\n- {t}");
        }
    }
    truncate(&s, 4000)
}

/// Map cargo-deny's diagnostic code to a coarse category.
fn category_for(code: &str) -> String {
    let c = code.to_lowercase();
    if c.contains("vulnerab") || c.contains("advisory") || c.contains("rustsec") {
        "advisory".into()
    } else if c.contains("licen") {
        "license".into()
    } else if c.contains("ban") || c.contains("denied") {
        "banned".into()
    } else if c.contains("unmaintained") || c.contains("unsound") {
        "advisory".into()
    } else {
        code.to_string()
    }
}

fn severity_of(raw: &str) -> String {
    match raw {
        "error" => "High",
        "warning" => "Medium",
        _ => "Low",
    }
    .to_string()
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() > max {
        s.chars().take(max).collect()
    } else {
        s.to_string()
    }
}

fn short_hash(s: &str) -> String {
    // Deterministic short id for messages without a crate (avoid Date/rand).
    let mut h: u64 = 1469598103934665603;
    for b in s.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    format!("{:x}", h & 0xffffffff)
}
