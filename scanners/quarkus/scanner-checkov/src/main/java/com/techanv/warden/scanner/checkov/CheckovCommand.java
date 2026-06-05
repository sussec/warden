package com.techanv.warden.scanner.checkov;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.Env;
import com.techanv.warden.client.WardenClient;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;

import picocli.CommandLine;

/**
 * Checkov IaC misconfiguration analyzer for Techanv Warden (Quarkus).
 *
 * Bridgecrew/Prisma Checkov has a far larger IaC ruleset than trivy config —
 * Terraform, CloudFormation, Kubernetes, Helm, Dockerfile, ARM, Serverless,
 * GitHub Actions — and reports findings with file/line for shift-left comments.
 */
@CommandLine.Command(name = "checkov", mixinStandardHelpOptions = true,
        description = "Run checkov (IaC) and report findings to Techanv Warden.")
public class CheckovCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Map<String, String> SEVERITY = Map.of(
            "CRITICAL", "Critical", "HIGH", "High", "MEDIUM", "Medium", "LOW", "Low");

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("checkov", "Sast", project);
        } catch (Exception e) {
            System.err.println("[checkov] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = List.of("checkov", "-d", project, "-o", "json", "--compact", "--quiet");
            System.out.println("[checkov] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd).redirectErrorStream(false).start();
            byte[] stdout = run.getInputStream().readAllBytes();
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();
            // checkov: 0 = all passed, 1 = failed checks found; both are valid runs.
            if (code != 0 && code != 1) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank() ? "checkov failed (exit " + code + ")"
                        : t.substring(Math.max(0, t.length() - 500)));
            }

            List<Finding> findings = new ArrayList<>();
            if (stdout.length > 0) {
                JsonNode root = MAPPER.readTree(stdout);
                // checkov emits one object per framework, or a single object.
                if (root.isArray()) {
                    for (JsonNode framework : root) {
                        collect(framework, project, findings);
                    }
                } else {
                    collect(root, project, findings);
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
            System.err.println("[checkov] failed: " + exc.getMessage());
            return 1;
        }
    }

    private static void collect(JsonNode framework, String project, List<Finding> findings) {
        for (JsonNode c : framework.path("results").path("failed_checks")) {
            String checkId = c.path("check_id").asText("unknown");
            String filePath = c.path("file_path").asText("");
            String path = relativize(filePath, project);
            JsonNode range = c.path("file_line_range");
            Integer start = range.isArray() && range.size() > 0 ? range.get(0).asInt() : null;
            Integer end = range.isArray() && range.size() > 1 ? range.get(1).asInt() : null;
            String guideline = c.path("guideline").asText("");

            Finding f = new Finding();
            f.identity = checkId + ":" + path + ":" + start;
            f.ruleId = checkId;
            f.name = c.path("check_name").asText(checkId);
            String desc = c.path("check_name").asText(checkId);
            if (!guideline.isBlank()) desc = desc + "\n\nGuideline: " + guideline;
            f.description = desc;
            f.category = checkId;
            f.severity = SEVERITY.getOrDefault(c.path("severity").asText("").toUpperCase(), "Medium");
            FindingLocation loc = new FindingLocation();
            loc.path = path;
            loc.startLine = start != null && start > 0 ? start : null;
            loc.endLine = end != null && end > 0 ? end : null;
            f.location = loc;
            findings.add(f);
        }
    }

    private static String relativize(String file, String project) {
        try {
            String f = file.startsWith("/") ? file : project + "/" + file;
            return Path.of(project).toAbsolutePath().relativize(Path.of(f).toAbsolutePath()).toString();
        } catch (Exception e) {
            return file.startsWith("/") ? file.substring(1) : file;
        }
    }
}
