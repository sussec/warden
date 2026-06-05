package com.techanv.warden.scanner.trivyimage;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.WardenClient;
import com.techanv.warden.client.model.PackageInfo;
import com.techanv.warden.client.model.VulnerabilityInfo;

import picocli.CommandLine;

/** Trivy container-image vulnerability analyzer for Techanv Warden (Quarkus port). */
@CommandLine.Command(name = "trivy-image", mixinStandardHelpOptions = true,
        description = "Run trivy image (container) and report dependencies to Techanv Warden.")
public class TrivyImageCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String imageRef = System.getenv("IMAGE_REF");
        if (imageRef == null || imageRef.isBlank()) {
            System.err.println("[trivy-image] missing required environment variable IMAGE_REF");
            return 2;
        }
        String output = "/tmp/trivy.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("trivy", "Container", "/src", imageRef);
        } catch (Exception e) {
            System.err.println("[trivy-image] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = List.of("trivy", "image", "--format", "json",
                    "--output", output, "--list-all-pkgs", imageRef);
            System.out.println("[trivy-image] " + String.join(" ", cmd));
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
            System.err.println("[trivy-image] failed: " + exc.getMessage());
            return 1;
        }
    }
}
