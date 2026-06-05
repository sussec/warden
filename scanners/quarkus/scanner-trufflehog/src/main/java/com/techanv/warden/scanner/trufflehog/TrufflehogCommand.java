package com.techanv.warden.scanner.trufflehog;

import java.nio.file.Path;
import java.util.LinkedHashMap;
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

/** TruffleHog git-history secret-detection analyzer for Techanv Warden (Quarkus port). */
@CommandLine.Command(name = "trufflehog", mixinStandardHelpOptions = true,
        description = "Run trufflehog and report secrets to Techanv Warden.")
public class TrufflehogCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("trufflehog", "Secret", project);
        } catch (Exception e) {
            System.err.println("[trufflehog] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = List.of("trufflehog", "filesystem", project, "--json", "--no-update");
            System.out.println("[trufflehog] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd).start();
            String stdout = new String(run.getInputStream().readAllBytes());
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();
            if (code != 0 && stdout.isBlank()) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank() ? "trufflehog failed" : t.substring(Math.max(0, t.length() - 500)));
            }

            Map<String, Finding> findings = new LinkedHashMap<>();
            for (String raw : stdout.split("\n")) {
                String line = raw.strip();
                if (line.isEmpty()) continue;
                JsonNode secret;
                try {
                    secret = MAPPER.readTree(line);
                } catch (Exception e) {
                    continue;
                }
                if (!secret.isObject()) continue;

                JsonNode fs = secret.path("SourceMetadata").path("Data").path("Filesystem");
                String file = fs.path("file").asText("unknown");
                int fileLine = fs.path("line").asInt(0);
                String detector = secret.path("DetectorName").asText("secret");
                String path = file.startsWith("/") ? relativize(file, project) : file;

                String identity = "trufflehog:" + detector + ":" + path + ":" + fileLine;
                if (findings.containsKey(identity)) continue;

                Finding f = new Finding();
                f.identity = identity;
                f.ruleId = detector;
                f.name = detector + " secret";
                f.description = "Potential secret detected by detector `" + detector
                        + "`. Rotate the credential immediately and remove it from the repository history.";
                f.category = "CWE-798";
                f.severity = "Critical";
                FindingLocation loc = new FindingLocation();
                loc.path = path;
                loc.snippet = null;
                loc.startLine = fileLine > 0 ? fileLine : null;
                f.location = loc;
                findings.put(identity, f);
            }

            client.uploadFindings(scanId, List.copyOf(findings.values()));
            client.completeScan(scanId, null);
            return 0;
        } catch (Exception exc) {
            try {
                client.completeScan(scanId, exc.getMessage());
            } catch (Exception ignore) {
                // best effort
            }
            System.err.println("[trufflehog] failed: " + exc.getMessage());
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
