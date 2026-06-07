package com.techanv.warden.scanner.trivylicense;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.Env;
import com.techanv.warden.client.WardenClient;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;

import picocli.CommandLine;

/**
 * Trivy OSS-license scanner for Techanv Warden (Quarkus port).
 *
 * Reuses the Trivy engine in license mode ({@code trivy fs --scanners license})
 * to surface per-package license-policy concerns — closing the license-
 * compliance gap that the vuln/SCA scanners do not cover. Trivy classifies each
 * detected license by Category (Forbidden/Restricted/Reciprocal/Notice/…) and a
 * Severity; we map each to a Warden finding.
 *
 * Optional environment:
 *   TRIVY_LICENSE_FULL   "true" — full license scan of file contents
 *                        (--license-full), not just package metadata
 */
@CommandLine.Command(name = "trivy-license", mixinStandardHelpOptions = true,
        description = "Run trivy (license scanner) and report license findings to Techanv Warden.")
public class TrivyLicenseCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String output = "/tmp/trivy-license.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("trivy-license", "Dependency", project);
        } catch (Exception e) {
            System.err.println("[trivy-license] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = new ArrayList<>(List.of(
                    "trivy", "fs", "--scanners", "license",
                    "--format", "json", "--output", output));
            if (Env.get("TRIVY_LICENSE_FULL", "").equalsIgnoreCase("true")) {
                cmd.add("--license-full");
            }
            cmd.add(project);
            System.out.println("[trivy-license] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectErrorStream(false).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();

            Path reportPath = Path.of(output);
            if (!Files.exists(reportPath) || Files.size(reportPath) == 0) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank()
                        ? "trivy produced no report (exit " + code + ")"
                        : t.substring(Math.max(0, t.length() - 600)));
            }

            List<Finding> findings = new ArrayList<>();
            Set<String> seen = new LinkedHashSet<>();
            JsonNode root = MAPPER.readTree(Files.readAllBytes(reportPath));
            for (JsonNode result : root.path("Results")) {
                String target = result.path("Target").asText("");
                for (JsonNode lic : result.path("Licenses")) {
                    String pkg = lic.path("PkgName").asText("");
                    String name = lic.path("Name").asText("unknown");
                    String category = lic.path("Category").asText("");
                    String filePath = firstNonBlank(lic.path("FilePath").asText(""), target, "license");

                    String identity = "trivy-license:" + (pkg.isBlank() ? filePath : pkg) + ":" + name;
                    if (!seen.add(identity)) continue;

                    Finding f = new Finding();
                    f.identity = identity;
                    f.ruleId = "license/" + name;
                    f.name = pkg.isBlank()
                            ? "License " + name + (category.isBlank() ? "" : " (" + category + ")")
                            : pkg + ": " + name + (category.isBlank() ? "" : " (" + category + ")");
                    f.description = describe(pkg, name, category, lic);
                    f.category = category.isBlank() ? "license" : category;
                    f.severity = severityOf(lic.path("Severity").asText(""), category);
                    FindingLocation loc = new FindingLocation();
                    loc.path = filePath;
                    f.location = loc;
                    findings.add(f);
                }
            }

            client.uploadFindings(scanId, findings);
            client.completeScan(scanId, null);
            return 0;
        } catch (Exception exc) {
            try {
                client.completeScan(scanId, exc.getMessage());
            } catch (Exception ignore) {
                // best effort
            }
            System.err.println("[trivy-license] failed: " + exc.getMessage());
            return 1;
        }
    }

    /** Prefer Trivy's own license Severity; fall back to bucketing the Category. */
    private static String severityOf(String severity, String category) {
        switch (severity.toUpperCase()) {
            case "CRITICAL": return "Critical";
            case "HIGH": return "High";
            case "MEDIUM": return "Medium";
            case "LOW": return "Low";
            default:
                switch (category.toUpperCase()) {
                    case "FORBIDDEN": return "Critical";
                    case "RESTRICTED": return "High";
                    case "RECIPROCAL": return "Medium";
                    case "NOTICE": case "PERMISSIVE": return "Low";
                    default: return "Info";
                }
        }
    }

    private static String describe(String pkg, String name, String category, JsonNode lic) {
        StringBuilder sb = new StringBuilder();
        if (!pkg.isBlank()) sb.append("Package ").append(pkg).append(" uses license ");
        else sb.append("Detected license ");
        sb.append(name).append(".");
        if (!category.isBlank()) sb.append(" Category: ").append(category).append('.');
        String link = lic.path("Link").asText("");
        if (!link.isBlank()) sb.append("\n\n").append(link);
        return sb.toString();
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
