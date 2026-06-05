package com.techanv.warden.scanner.grype;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.Env;
import com.techanv.warden.client.WardenClient;
import com.techanv.warden.client.model.PackageInfo;
import com.techanv.warden.client.model.VulnerabilityInfo;

import picocli.CommandLine;

/** Grype SCA (dependency) analyzer for Techanv Warden (Quarkus port). */
@CommandLine.Command(name = "grype", mixinStandardHelpOptions = true,
        description = "Run grype (SCA) and report dependencies to Techanv Warden.")
public class GrypeCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Map<String, String> SEVERITY = Map.of(
            "Critical", "Critical", "High", "High", "Medium", "Medium",
            "Low", "Low", "Negligible", "Info", "Unknown", "Info");

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String output = "/tmp/grype.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("grype", "Dependency", project);
        } catch (Exception e) {
            System.err.println("[grype] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = List.of("grype", "dir:" + project, "-o", "json", "--file", output);
            System.out.println("[grype] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            if (run.waitFor() != 0) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank() ? "grype failed" : t.substring(Math.max(0, t.length() - 500)));
            }
            JsonNode report = MAPPER.readTree(Files.readAllBytes(Path.of(output)));
            Map<String, PackageInfo> packages = new LinkedHashMap<>();
            List<VulnerabilityInfo> vulns = new ArrayList<>();
            for (JsonNode match : report.path("matches")) {
                JsonNode artifact = match.path("artifact");
                String name = artifact.path("name").asText("unknown");
                String version = artifact.path("version").asText("unknown");
                String pkgId = firstNonBlank(artifact.path("purl").asText(""), "pkg:generic/" + name + "@" + version);
                JsonNode locations = artifact.path("locations");
                String location = locations.isArray() && locations.size() > 0
                        ? locations.get(0).path("path").asText(null) : null;
                packages.putIfAbsent(pkgId,
                        new PackageInfo(pkgId, name, version, artifact.path("type").asText("unknown"), location));

                JsonNode vuln = match.path("vulnerability");
                String vulnId = vuln.path("id").asText("unknown");
                JsonNode fixVersions = vuln.path("fix").path("versions");
                String fixed = fixVersions.isArray() && fixVersions.size() > 0 ? fixVersions.get(0).asText("") : "";

                VulnerabilityInfo vi = new VulnerabilityInfo();
                vi.identity = vulnId;
                vi.name = vulnId;
                String d = firstNonBlank(vuln.path("description").asText(""), vulnId);
                vi.description = d.length() > 4000 ? d.substring(0, 4000) : d;
                vi.fixedVersion = fixed;
                vi.severity = SEVERITY.getOrDefault(vuln.path("severity").asText(""), "Info");
                vi.pkgId = pkgId;
                vi.pkgName = name;
                vi.publishedAt = null;
                vulns.add(vi);
            }
            client.uploadDependencies(scanId, packages.values(), vulns);
            client.completeScan(scanId, null);
            return 0;
        } catch (Exception exc) {
            try {
                client.completeScan(scanId, exc.getMessage());
            } catch (Exception ignore) {
                // best effort
            }
            System.err.println("[grype] failed: " + exc.getMessage());
            return 1;
        }
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
