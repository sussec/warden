//! cargo-geiger scanner for Techanv Warden.
//!
//! cargo-geiger counts `unsafe` code usage across a Rust project's dependency
//! tree — a code-safety signal (not a vulnerability). Crates that actually use
//! unsafe become informational findings. Rust-native scanner using the shared
//! `warden.rs` client; results ingest as Sast findings.
//!
//! NOTE: cargo-geiger instruments the BUILD, so it compiles the project and its
//! dependencies — it needs the full toolchain, the crates' build dependencies,
//! and network at scan time. It is heavier and more fragile than the other SCA
//! scanners; treat its output as advisory.

mod warden;

use std::path::Path;
use std::process::Command;

use warden::{Finding, FindingLocation, WardenClient};

fn main() -> std::process::ExitCode {
    match run() {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("[cargo-geiger] failed: {e}");
            std::process::ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), String> {
    let project = std::env::var("PROJECT_PATH").unwrap_or_else(|_| "/src".to_string());
    let client = WardenClient::from_env()?;
    let scan_id = client
        .create_scan("cargo-geiger", "Sast", &project)
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
        println!("[cargo-geiger] no Cargo.toml in {project}; nothing to scan");
        return Ok(Vec::new());
    }

    // --output-format Json prints a single JSON document to stdout. cargo-geiger
    // builds the project, so this can be slow and may fail on crates whose build
    // needs system libraries not present in the image.
    println!("[cargo-geiger] cargo-geiger --output-format Json");
    let out = Command::new("cargo-geiger")
        .args(["--output-format", "Json", "--quiet"])
        .current_dir(project)
        .output()
        .map_err(|e| format!("spawn cargo-geiger: {e}"))?;

    let stdout = String::from_utf8_lossy(&out.stdout);
    let report: serde_json::Value = serde_json::from_str(stdout.trim()).map_err(|e| {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let tail: String = stderr.chars().rev().take(600).collect::<String>().chars().rev().collect();
        format!("cargo-geiger produced no JSON ({e}): {tail}")
    })?;

    let mut findings = Vec::new();
    for pkg in report.pointer("/packages").and_then(|v| v.as_array()).cloned().unwrap_or_default() {
        let id = pkg.pointer("/package/id");
        let name = id.and_then(|i| i.get("name")).and_then(|v| v.as_str()).unwrap_or("").to_string();
        let version = id.and_then(|i| i.get("version")).and_then(|v| v.as_str()).unwrap_or("").to_string();
        if name.is_empty() {
            continue;
        }
        let used = pkg.pointer("/unsafety/used");
        let total = unsafe_total(used);
        let forbids = pkg
            .pointer("/unsafety/forbids_unsafe")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if total == 0 {
            continue; // only crates that actually use unsafe are findings
        }

        findings.push(Finding {
            identity: format!("cargo-geiger:{name}@{version}"),
            rule_id: Some("unsafe-usage".into()),
            name: format!("Unsafe code used in {name} {version}"),
            description: format!(
                "cargo-geiger counted {total} use(s) of `unsafe` in {name} {version} \
                 (functions/expressions/impls/traits/methods). forbids_unsafe = {forbids}. \
                 Unsafe code is not a vulnerability by itself, but is worth review.",
            ),
            category: Some("unsafe".into()),
            // Informational code-safety signal.
            severity: "Low".into(),
            location: Some(FindingLocation {
                path: Some(format!("Cargo.toml · {name}@{version}")),
                ..Default::default()
            }),
        });
    }
    Ok(findings)
}

/// Sum the `unsafe_` counts across the metric categories under `used`.
fn unsafe_total(used: Option<&serde_json::Value>) -> u64 {
    let used = match used {
        Some(u) => u,
        None => return 0,
    };
    let mut total = 0u64;
    for key in ["functions", "exprs", "item_impls", "item_traits", "methods"] {
        if let Some(n) = used.pointer(&format!("/{key}/unsafe_")).and_then(|v| v.as_u64()) {
            total += n;
        }
    }
    total
}
