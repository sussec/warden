package com.techanv.warden.scanner.gitleaks;

import java.io.File;
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
 * Gitleaks secret-detection analyzer for Techanv Warden — Quarkus reference port
 * of the Python wrapper. Runs gitleaks, maps leaks to findings, and ingests
 * them through the shared {@link WardenClient} (with shift-left MR comments).
 */
@CommandLine.Command(name = "gitleaks", mixinStandardHelpOptions = true,
        description = "Run gitleaks and report secrets to Techanv Warden.")
public class GitleaksCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String output = "/tmp/gitleaks.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("gitleaks", "Secret", project);
        } catch (Exception e) {
            System.err.println("[gitleaks] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = List.of("gitleaks", "detect", "--source", project, "--no-git",
                    "--report-format", "json", "--report-path", output, "--exit-code", "0");
            System.out.println("[gitleaks] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd).redirectErrorStream(false).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();
            if (code != 0) {
                String tail = stderr.strip();
                throw new RuntimeException(tail.isBlank()
                        ? "gitleaks failed" : tail.substring(Math.max(0, tail.length() - 500)));
            }

            List<Finding> findings = new ArrayList<>();
            File report = new File(output);
            if (report.exists() && report.length() > 0) {
                JsonNode leaks = MAPPER.readTree(Files.readAllBytes(Path.of(output)));
                if (leaks.isArray()) {
                    for (JsonNode leak : leaks) {
                        findings.add(toFinding(leak, project));
                    }
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
            System.err.println("[gitleaks] failed: " + exc.getMessage());
            return 1;
        }
    }

    private static Finding toFinding(JsonNode leak, String project) {
        String file = leak.path("File").asText("unknown");
        String path = file.startsWith("/") ? relativize(file, project) : file;
        String rule = leak.path("RuleID").asText("secret");
        int line = leak.path("StartLine").asInt(0);
        String fingerprint = leak.path("Fingerprint").asText(String.valueOf(line));

        Finding f = new Finding();
        f.identity = "gitleaks:" + rule + ":" + path + ":" + fingerprint;
        f.ruleId = rule;
        f.name = leak.path("Description").asText(rule);
        f.description = "Potential secret detected by rule `" + rule
                + "`. Rotate the credential and remove it from the repository history.";
        f.category = "CWE-798";
        f.severity = "Critical";

        FindingLocation loc = new FindingLocation();
        loc.path = path;
        loc.snippet = null; // never upload the matched secret itself
        loc.startLine = line > 0 ? line : null;
        int end = leak.path("EndLine").asInt(0);
        loc.endLine = end > 0 ? end : null;
        f.location = loc;
        return f;
    }

    private static String relativize(String file, String project) {
        try {
            return Path.of(project).toAbsolutePath().relativize(Path.of(file).toAbsolutePath()).toString();
        } catch (Exception e) {
            return file;
        }
    }
}
