package com.techanv.warden.scanner.syft;

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

/**
 * Syft SBOM analyzer for Techanv Warden (Quarkus).
 *
 * Generates a Software Bill of Materials and ingests the full dependency
 * inventory (no vulnerabilities) through the SCA path — the 2026 supply-chain
 * compliance baseline (CycloneDX/SPDX-grade inventory of every component).
 */
@CommandLine.Command(name = "syft", mixinStandardHelpOptions = true,
        description = "Generate an SBOM with syft and report the inventory to Techanv Warden.")
public class SyftCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String output = "/tmp/sbom.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("syft", "Dependency", project);
        } catch (Exception e) {
            System.err.println("[syft] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = List.of("syft", "scan", "dir:" + project, "-o", "syft-json=" + output, "-q");
            System.out.println("[syft] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd).redirectErrorStream(false).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            if (run.waitFor() != 0) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank() ? "syft failed" : t.substring(Math.max(0, t.length() - 500)));
            }

            Map<String, PackageInfo> packages = new LinkedHashMap<>();
            Path report = Path.of(output);
            if (Files.exists(report) && Files.size(report) > 0) {
                JsonNode root = MAPPER.readTree(Files.readAllBytes(report));
                for (JsonNode a : root.path("artifacts")) {
                    String name = a.path("name").asText("unknown");
                    String version = a.path("version").asText("unknown");
                    String type = a.path("type").asText("unknown");
                    String purl = a.path("purl").asText("");
                    String pkgId = purl.isBlank() ? "pkg:" + type + "/" + name + "@" + version : purl;
                    JsonNode locations = a.path("locations");
                    String location = locations.isArray() && locations.size() > 0
                            ? locations.get(0).path("path").asText(null) : null;
                    packages.putIfAbsent(pkgId, new PackageInfo(pkgId, name, version, type, location));
                }
            }
            // SBOM is an inventory — packages only, no vulnerabilities.
            client.uploadDependencies(scanId, packages.values(), new ArrayList<VulnerabilityInfo>());
            client.completeScan(scanId, null);
            return 0;
        } catch (Exception exc) {
            try {
                client.completeScan(scanId, exc.getMessage());
            } catch (Exception ignore) {
                // best effort
            }
            System.err.println("[syft] failed: " + exc.getMessage());
            return 1;
        }
    }
}
