package com.techanv.warden.scanner.kingfisher;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.Env;
import com.techanv.warden.client.WardenClient;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;

import picocli.CommandLine;

/**
 * Kingfisher secret scanner (MongoDB) analyzer for Techanv Warden (Quarkus port).
 *
 * Kingfisher's differentiator over gitleaks/trufflehog is live validation: it
 * calls provider APIs to confirm whether a leaked credential is still active.
 * The JSON report is {@code { "findings": [ { "rule": {...}, "finding": {...} } ] }};
 * each finding carries a validation.status of "Active Credential" /
 * "Inactive Credential" / (not attempted). We promote validated-live secrets to
 * Critical so triage burns down confirmed-exploitable credentials first.
 *
 * Kingfisher exits 0 (no findings), 200 (findings), or 205 (validated findings)
 * — all are successful scans; only an absent report is a failure.
 *
 * Optional environment:
 *   KINGFISHER_NO_VALIDATE   "true" — pattern match only, skip live validation
 *   KINGFISHER_ARGS          extra raw args appended to the CLI (space-separated)
 */
@CommandLine.Command(name = "kingfisher", mixinStandardHelpOptions = true,
        description = "Run Kingfisher (secret detection + live validation) and report to Techanv Warden.")
public class KingfisherCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String output = "/tmp/kingfisher.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("kingfisher", "Secret", project);
        } catch (Exception e) {
            System.err.println("[kingfisher] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = new ArrayList<>(List.of(
                    "kingfisher", "scan", project, "--format", "json", "--output", output));
            if (Env.get("KINGFISHER_NO_VALIDATE", "").equalsIgnoreCase("true")) {
                cmd.add("--no-validate");
            }
            String extra = Env.get("KINGFISHER_ARGS", "");
            if (!extra.isBlank()) {
                for (String a : extra.trim().split("\\s+")) cmd.add(a);
            }
            System.out.println("[kingfisher] " + String.join(" ", cmd));
            // Discard stdout; keep stderr. Exit codes 0/200/205 are all success.
            Process run = new ProcessBuilder(cmd)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectErrorStream(false).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();

            Path reportPath = Path.of(output);
            if (!Files.exists(reportPath) || Files.size(reportPath) == 0) {
                // No findings can mean an empty/absent report on some versions — that is success.
                if (code == 0) {
                    client.uploadFindings(scanId, List.of());
                    client.completeScan(scanId, null);
                    return 0;
                }
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank()
                        ? "kingfisher produced no report (exit " + code + ")"
                        : t.substring(Math.max(0, t.length() - 500)));
            }

            List<Finding> findings = new ArrayList<>();
            JsonNode root = MAPPER.readTree(Files.readAllBytes(reportPath));
            for (JsonNode entry : root.path("findings")) {
                JsonNode rule = entry.path("rule");
                JsonNode f = entry.path("finding");
                String ruleId = rule.path("id").asText("kingfisher");
                String ruleName = firstNonBlank(rule.path("name").asText(""), ruleId);
                String path = f.path("path").asText("unknown");
                int line = f.path("line").asInt(0);
                String fingerprint = f.path("fingerprint").asText("");
                String confidence = f.path("confidence").asText("");
                String status = f.path("validation").path("status").asText("");
                boolean active = status.equalsIgnoreCase("Active Credential");

                Finding finding = new Finding();
                // Fingerprint keeps the identity stable across runs and lines.
                finding.identity = "kingfisher:" + ruleId + ":"
                        + (fingerprint.isBlank() ? path + ":" + line : fingerprint);
                finding.ruleId = ruleId;
                finding.name = ruleName;
                finding.description = describe(ruleName, confidence, status);
                finding.severity = severityOf(active, confidence);
                FindingLocation loc = new FindingLocation();
                loc.path = path;
                loc.startLine = line > 0 ? line : null;
                loc.startColumn = optInt(f, "column_start");
                loc.endColumn = optInt(f, "column_end");
                finding.location = loc;
                findings.add(finding);
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
            System.err.println("[kingfisher] failed: " + exc.getMessage());
            return 1;
        }
    }

    /**
     * A confirmed-live credential is the worst case → Critical. Otherwise lean on
     * Kingfisher's own confidence bucket (High/Medium/Low).
     */
    private static String severityOf(boolean active, String confidence) {
        if (active) return "Critical";
        switch (confidence.toLowerCase()) {
            case "high": return "High";
            case "medium": return "Medium";
            case "low": return "Low";
            default: return "Medium";
        }
    }

    private static String describe(String ruleName, String confidence, String status) {
        StringBuilder sb = new StringBuilder(ruleName);
        if (!confidence.isBlank()) sb.append(" (confidence: ").append(confidence).append(")");
        if (!status.isBlank()) sb.append("\n\nValidation: ").append(status);
        return sb.toString();
    }

    private static Integer optInt(JsonNode node, String field) {
        JsonNode v = node.path(field);
        return v.isInt() || v.isLong() ? v.asInt() : null;
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
