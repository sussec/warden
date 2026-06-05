package com.techanv.warden.scanner.nuclei;

import java.io.File;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.WardenClient;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;

import picocli.CommandLine;

/** Nuclei template-based DAST analyzer for Techanv Warden (Quarkus port). */
@CommandLine.Command(name = "nuclei", mixinStandardHelpOptions = true,
        description = "Run nuclei against a target URL and report to Techanv Warden.")
public class NucleiCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Map<String, String> SEVERITY = Map.of(
            "critical", "Critical", "high", "High", "medium", "Medium", "low", "Low", "info", "Info");

    @Override
    public Integer call() {
        String target = System.getenv("TARGET_URL");
        if (target == null || target.isBlank()) {
            System.err.println("[nuclei] missing required environment variable TARGET_URL");
            return 2;
        }
        String output = "/tmp/nuclei.jsonl";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("nuclei", "Dast", "/tmp", host(target));
        } catch (Exception e) {
            System.err.println("[nuclei] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = List.of("nuclei", "-u", target, "-jsonl", "-o", output, "-silent");
            System.out.println("[nuclei] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            run.getInputStream().readAllBytes();
            run.waitFor();

            List<Finding> findings = new ArrayList<>();
            File report = new File(output);
            if (report.exists()) {
                for (String line : Files.readAllLines(Path.of(output))) {
                    String l = line.strip();
                    if (l.isEmpty()) continue;
                    JsonNode r = MAPPER.readTree(l);
                    JsonNode info = r.path("info");
                    String templateId = r.path("template-id").asText("");
                    String matchedAt = firstNonBlank(r.path("matched-at").asText(""), target);
                    String severity = SEVERITY.getOrDefault(info.path("severity").asText("").toLowerCase(), "Info");
                    JsonNode cwes = info.path("classification").path("cwe-id");
                    String category = cwes.isArray() && cwes.size() > 0 ? cwes.get(0).asText() : null;

                    Finding f = new Finding();
                    f.identity = "nuclei:" + templateId + ":" + matchedAt;
                    f.ruleId = templateId;
                    f.name = firstNonBlank(info.path("name").asText(""), templateId, "Nuclei finding");
                    f.description = firstNonBlank(info.path("description").asText(""), info.path("name").asText(""), templateId);
                    f.category = category;
                    f.severity = severity;
                    FindingLocation loc = new FindingLocation();
                    loc.path = matchedAt;
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
            System.err.println("[nuclei] failed: " + exc.getMessage());
            return 1;
        }
    }

    private static String host(String url) {
        try {
            String h = URI.create(url).getHost();
            return h != null ? h : url;
        } catch (Exception e) {
            return url;
        }
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
