package com.techanv.warden.scanner.prowler;

import java.io.File;
import java.nio.file.DirectoryStream;
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
 * Prowler cloud-security-posture (CSPM) scanner for Techanv Warden (Quarkus).
 *
 * Prowler audits a live cloud account (AWS/Azure/GCP) against CIS/SOC2/PCI and
 * many other frameworks. This opens Warden's Cloud scanner category. The target
 * is the cloud provider (PROWLER_PROVIDER); provider credentials come from the
 * scanner container's environment (e.g. AWS_ACCESS_KEY_ID/SECRET/SESSION_TOKEN/
 * AWS_DEFAULT_REGION). Prowler's OCSF JSON output is mapped to findings (only
 * FAIL results are ingested).
 *
 * Environment:
 *   PROWLER_PROVIDER   aws | azure | gcp | kubernetes   (default aws)
 *   PROWLER_ARGS       extra raw args appended to the CLI (e.g. --service iam)
 *   plus the provider's credential env vars
 */
@CommandLine.Command(name = "prowler", mixinStandardHelpOptions = true,
        description = "Run Prowler (cloud CSPM) and report findings to Techanv Warden.")
public class ProwlerCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String provider = Env.get("PROWLER_PROVIDER", "aws");
        String outDir = "/tmp/prowler";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("prowler", "Cloud", "/tmp", "cloud:" + provider);
        } catch (Exception e) {
            System.err.println("[prowler] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            Files.createDirectories(Path.of(outDir));
            List<String> cmd = new ArrayList<>(List.of(
                    "prowler", provider,
                    "--output-formats", "json-ocsf",
                    "--output-directory", outDir,
                    "--status", "FAIL"));
            String extra = Env.get("PROWLER_ARGS", "");
            if (!extra.isBlank()) {
                for (String a : extra.trim().split("\\s+")) cmd.add(a);
            }
            System.out.println("[prowler] " + String.join(" ", cmd));
            // Prowler's exit code reflects findings/errors; success is judged by a
            // parseable OCSF report (a missing report means it could not run, e.g.
            // missing credentials).
            Process run = new ProcessBuilder(cmd)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectErrorStream(false).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();

            Path report = findOcsf(Path.of(outDir));
            if (report == null) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank()
                        ? "prowler produced no OCSF report (exit " + code
                          + "); check provider credentials"
                        : t.substring(Math.max(0, t.length() - 800)));
            }

            List<Finding> findings = new ArrayList<>();
            Set<String> seen = new LinkedHashSet<>();
            JsonNode root = MAPPER.readTree(Files.readAllBytes(report));
            // The OCSF output is a JSON array of detection findings.
            for (JsonNode finding : root) {
                String status = firstNonBlank(
                        finding.path("status_code").asText(""),
                        finding.path("status").asText(""));
                if (!status.equalsIgnoreCase("FAIL")) continue;

                String checkId = firstNonBlank(
                        finding.path("metadata").path("event_code").asText(""),
                        finding.path("finding_info").path("uid").asText(""), "prowler");
                JsonNode resource = finding.path("resources").path(0);
                String resourceUid = firstNonBlank(
                        resource.path("uid").asText(""), resource.path("name").asText(""), "account");

                String identity = "prowler:" + checkId + ":" + resourceUid;
                if (!seen.add(identity)) continue;

                Finding f = new Finding();
                f.identity = identity;
                f.ruleId = checkId;
                f.name = firstNonBlank(
                        finding.path("finding_info").path("title").asText(""), checkId);
                f.description = describe(finding, resource);
                f.category = firstNonBlank(
                        finding.path("cloud").path("provider").asText(""), provider);
                f.severity = severityOf(finding.path("severity").asText(""));
                FindingLocation loc = new FindingLocation();
                String region = firstNonBlank(
                        resource.path("region").asText(""),
                        finding.path("cloud").path("region").asText(""));
                loc.path = resourceUid + (region.isBlank() ? "" : " · " + region);
                f.location = loc;
                findings.add(f);
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
            System.err.println("[prowler] failed: " + exc.getMessage());
            return 1;
        }
    }

    /** Locate the OCSF JSON report Prowler writes into the output directory. */
    private static Path findOcsf(Path dir) throws Exception {
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir, "*.ocsf.json")) {
            for (Path p : stream) {
                if (Files.size(p) > 0) return p;
            }
        }
        // Fallback: any non-empty .json in the directory.
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir, "*.json")) {
            for (Path p : stream) {
                if (Files.size(p) > 0) return p;
            }
        }
        return null;
    }

    private static String severityOf(String severity) {
        switch (severity.toLowerCase()) {
            case "critical": return "Critical";
            case "high": return "High";
            case "medium": return "Medium";
            case "low": return "Low";
            default: return "Info";
        }
    }

    private static String describe(JsonNode finding, JsonNode resource) {
        StringBuilder sb = new StringBuilder();
        String detail = firstNonBlank(
                finding.path("status_detail").asText(""),
                finding.path("risk_details").asText(""),
                finding.path("finding_info").path("desc").asText(""));
        if (!detail.isBlank()) sb.append(detail);
        String rtype = resource.path("type").asText("");
        String rname = firstNonBlank(resource.path("name").asText(""), resource.path("uid").asText(""));
        if (!rname.isBlank()) {
            sb.append(sb.length() == 0 ? "" : "\n\n").append("Resource: ")
              .append(rtype.isBlank() ? "" : rtype + " ").append(rname);
        }
        String remediation = finding.path("remediation").path("desc").asText("");
        if (!remediation.isBlank()) sb.append("\n\nRemediation: ").append(remediation);
        String d = sb.toString();
        return d.length() > 4000 ? d.substring(0, 4000) : d;
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
