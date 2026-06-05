package com.techanv.warden.scanner.guarddog;

import java.io.File;
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
 * GuardDog malicious-package analyzer for Techanv Warden (Quarkus).
 *
 * Datadog's GuardDog inspects dependency manifests for malicious-package
 * indicators — typosquatting, suspicious install scripts, obfuscated code,
 * exfiltration — i.e. supply-chain attacks that CVE-based SCA does not catch.
 */
@CommandLine.Command(name = "guarddog", mixinStandardHelpOptions = true,
        description = "Run guarddog (malicious-package detection) and report to Techanv Warden.")
public class GuardDogCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    // manifest file -> guarddog ecosystem
    private static final Map<String, String> MANIFESTS = Map.of(
            "requirements.txt", "pypi",
            "package.json", "npm",
            "go.mod", "go");

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("guarddog", "Sast", project);
        } catch (Exception e) {
            System.err.println("[guarddog] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<Finding> findings = new ArrayList<>();
            int scanned = 0;
            for (var entry : MANIFESTS.entrySet()) {
                File manifest = new File(project, entry.getKey());
                if (!manifest.isFile()) continue;
                scanned++;
                List<String> cmd = List.of("guarddog", entry.getValue(), "verify",
                        manifest.getPath(), "--output-format", "json");
                System.out.println("[guarddog] " + String.join(" ", cmd));
                Process run = new ProcessBuilder(cmd).redirectErrorStream(false).start();
                byte[] stdout = run.getInputStream().readAllBytes();
                run.getErrorStream().readAllBytes();
                run.waitFor(); // non-zero when malicious indicators found
                parse(stdout, entry.getKey(), findings);
            }
            if (scanned == 0) {
                System.out.println("[guarddog] no supported manifests (requirements.txt, package.json, go.mod)");
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
            System.err.println("[guarddog] failed: " + exc.getMessage());
            return 1;
        }
    }

    /** GuardDog verify emits a JSON array of per-dependency results. */
    private static void parse(byte[] stdout, String manifest, List<Finding> findings) {
        if (stdout == null || stdout.length == 0) return;
        JsonNode root;
        try {
            root = MAPPER.readTree(stdout);
        } catch (Exception e) {
            return;
        }
        Iterable<JsonNode> entries = root.isArray() ? root : List.of(root);
        for (JsonNode entry : entries) {
            int issues = entry.path("issues").asInt(0);
            if (issues <= 0) continue;
            String pkg = firstNonBlank(entry.path("package").asText(""), entry.path("dependency").asText(""), "package");
            String version = entry.path("version").asText("");
            StringBuilder detail = new StringBuilder();
            JsonNode results = entry.path("results");
            results.fieldNames().forEachRemaining(h -> {
                JsonNode v = results.path(h);
                if (v != null && !v.isNull() && !(v.isArray() && v.isEmpty()) && !v.asText("").isBlank()) {
                    detail.append("- ").append(h).append('\n');
                }
            });

            Finding f = new Finding();
            f.identity = "guarddog:" + pkg + ":" + version;
            f.ruleId = "malicious-package";
            f.name = "Malicious-package indicators in " + pkg;
            f.description = "GuardDog flagged " + issues + " indicator(s) for `" + pkg
                    + (version.isBlank() ? "" : "@" + version) + "`. Review before use:\n\n" + detail;
            f.category = "CWE-506"; // embedded malicious code
            f.severity = "Critical";
            FindingLocation loc = new FindingLocation();
            loc.path = manifest;
            f.location = loc;
            findings.add(f);
        }
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
