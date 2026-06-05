package com.techanv.warden.scanner.semgrep;

import java.nio.file.Files;
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

/** Semgrep SAST analyzer for Techanv Warden (Quarkus port). */
@CommandLine.Command(name = "semgrep", mixinStandardHelpOptions = true,
        description = "Run semgrep and report findings to Techanv Warden.")
public class SemgrepCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Map<String, String> SEVERITY = Map.of("ERROR", "High", "WARNING", "Medium", "INFO", "Info");
    private static final Map<String, String> META = Map.of(
            "critical", "Critical", "high", "High", "medium", "Medium", "low", "Low", "info", "Info");

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String rules = Env.get("SEMGREP_RULES", "p/default");
        String output = "/tmp/semgrep.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("semgrep", "Sast", project);
        } catch (Exception e) {
            System.err.println("[semgrep] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = new ArrayList<>(List.of(
                    "semgrep", "scan", "--json", "--output", output,
                    "--config", rules, "--metrics", "off", project));
            String excluded = System.getenv("SEMGREP_EXCLUDED_PATHS");
            if (excluded != null && !excluded.isBlank()) {
                for (String p : excluded.split(",")) {
                    cmd.add("--exclude");
                    cmd.add(p.strip());
                }
            }
            System.out.println("[semgrep] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();
            if (code != 0 && code != 1) { // 1 = findings present
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank() ? "semgrep failed" : t.substring(Math.max(0, t.length() - 500)));
            }

            List<Finding> findings = new ArrayList<>();
            JsonNode root = MAPPER.readTree(Files.readAllBytes(Path.of(output)));
            for (JsonNode r : root.path("results")) {
                findings.add(toFinding(r, project));
            }
            client.uploadFindings(scanId, findings);
            client.completeScan(scanId, null);
            return 0;
        } catch (Exception exc) {
            safeFail(client, scanId, exc);
            return 1;
        }
    }

    private static Finding toFinding(JsonNode r, String project) {
        String rawPath = r.path("path").asText("");
        String path = relativize(rawPath, project);
        String rule = r.path("check_id").asText("rule");
        JsonNode extra = r.path("extra");
        int startLine = r.path("start").path("line").asInt(0);
        int endLine = r.path("end").path("line").asInt(0);

        Finding f = new Finding();
        f.identity = rule + ":" + path + ":" + startLine;
        f.ruleId = rule;
        String last = rule.contains(".") ? rule.substring(rule.lastIndexOf('.') + 1) : rule;
        f.name = title(last.replace("-", " "));
        f.description = extra.path("message").asText(rule);
        JsonNode cwe = extra.path("metadata").path("cwe");
        f.category = cwe.isArray() && cwe.size() > 0 ? cwe.get(0).asText() : null;
        f.severity = severityOf(extra);

        FindingLocation loc = new FindingLocation();
        loc.path = path;
        String lines = extra.path("lines").asText("");
        loc.snippet = lines.isBlank() ? null : (lines.length() > 2000 ? lines.substring(0, 2000) : lines);
        loc.startLine = startLine > 0 ? startLine : null;
        loc.endLine = endLine > 0 ? endLine : null;
        f.location = loc;
        return f;
    }

    private static String severityOf(JsonNode extra) {
        String impact = extra.path("metadata").path("impact").asText("").toLowerCase();
        if (META.containsKey(impact)) return META.get(impact);
        return SEVERITY.getOrDefault(extra.path("severity").asText(""), "Info");
    }

    private static String title(String s) {
        StringBuilder b = new StringBuilder();
        for (String w : s.split(" ")) {
            if (w.isEmpty()) continue;
            b.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1)).append(' ');
        }
        return b.toString().strip();
    }

    private static String relativize(String file, String project) {
        try {
            return Path.of(project).toAbsolutePath().relativize(Path.of(file).toAbsolutePath()).toString();
        } catch (Exception e) {
            return file;
        }
    }

    static void safeFail(WardenClient client, String scanId, Exception exc) {
        try {
            client.completeScan(scanId, exc.getMessage());
        } catch (Exception ignore) {
            // best effort
        }
        System.err.println("[scanner] failed: " + exc.getMessage());
    }
}
