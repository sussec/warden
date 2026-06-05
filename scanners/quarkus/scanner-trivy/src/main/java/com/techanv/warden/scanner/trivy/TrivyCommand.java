package com.techanv.warden.scanner.trivy;

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

/** Trivy SCA (dependency) analyzer for Techanv Warden (Quarkus port). */
@CommandLine.Command(name = "trivy", mixinStandardHelpOptions = true,
        description = "Run trivy fs (SCA) and report dependencies to Techanv Warden.")
public class TrivyCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String output = "/tmp/trivy.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("trivy", "Dependency", project);
        } catch (Exception e) {
            System.err.println("[trivy] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = List.of("trivy", "fs", "--scanners", "vuln", "--format", "json",
                    "--output", output, "--list-all-pkgs", project);
            System.out.println("[trivy] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            if (run.waitFor() != 0) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank() ? "trivy failed" : t.substring(Math.max(0, t.length() - 500)));
            }
            JsonNode report = MAPPER.readTree(Files.readAllBytes(Path.of(output)));
            Map<String, PackageInfo> packages = new LinkedHashMap<>();
            List<VulnerabilityInfo> vulns = new ArrayList<>();
            TrivyParser.parse(report, packages, vulns);
            client.uploadDependencies(scanId, packages.values(), vulns);
            client.completeScan(scanId, null);
            return 0;
        } catch (Exception exc) {
            try {
                client.completeScan(scanId, exc.getMessage());
            } catch (Exception ignore) {
                // best effort
            }
            System.err.println("[trivy] failed: " + exc.getMessage());
            return 1;
        }
    }
}
