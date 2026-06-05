package com.techanv.warden.scanner.trivyiac;

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

/** Trivy IaC misconfiguration analyzer for Techanv Warden (Quarkus port). */
@CommandLine.Command(name = "trivy-iac", mixinStandardHelpOptions = true,
        description = "Run trivy config (IaC) and report findings to Techanv Warden.")
public class TrivyIacCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    static final Map<String, String> SEVERITY = Map.of(
            "CRITICAL", "Critical", "HIGH", "High", "MEDIUM", "Medium", "LOW", "Low", "UNKNOWN", "Info");

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String output = "/tmp/trivy.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("trivy-iac", "Sast", project);
        } catch (Exception e) {
            System.err.println("[trivy-iac] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = List.of("trivy", "config", "--format", "json", "--output", output, project);
            System.out.println("[trivy-iac] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            if (run.waitFor() != 0) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank() ? "trivy failed" : t.substring(Math.max(0, t.length() - 500)));
            }

            JsonNode report = MAPPER.readTree(Files.readAllBytes(Path.of(output)));
            List<Finding> findings = new ArrayList<>();
            for (JsonNode result : report.path("Results")) {
                String target = result.path("Target").asText("");
                String relPath = target.isBlank() ? target : relativize(target, project);
                for (JsonNode m : result.path("Misconfigurations")) {
                    JsonNode cause = m.path("CauseMetadata");
                    Integer start = cause.has("StartLine") ? cause.path("StartLine").asInt() : null;
                    Integer end = cause.has("EndLine") ? cause.path("EndLine").asInt() : null;
                    String id = m.path("ID").asText("unknown");
                    String desc = m.path("Description").asText("");
                    String resolution = m.path("Resolution").asText("");
                    if (!resolution.isBlank()) desc = desc + "\n\nResolution: " + resolution;

                    Finding f = new Finding();
                    f.identity = id + ":" + relPath + ":" + start;
                    f.ruleId = id;
                    f.name = m.path("Title").asText(id);
                    f.description = desc.length() > 4000 ? desc.substring(0, 4000) : desc;
                    f.category = id;
                    f.severity = SEVERITY.getOrDefault(m.path("Severity").asText(""), "Info");
                    FindingLocation loc = new FindingLocation();
                    loc.path = relPath;
                    loc.startLine = start;
                    loc.endLine = end;
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
            System.err.println("[trivy-iac] failed: " + exc.getMessage());
            return 1;
        }
    }

    private static String relativize(String file, String project) {
        try {
            return Path.of(project).toAbsolutePath().relativize(Path.of(file).toAbsolutePath()).toString();
        } catch (Exception e) {
            return file;
        }
    }
}
