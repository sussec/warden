package com.techanv.warden.scanner.osv;

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
 * OSV-Scanner SCA + supply-chain analyzer for Techanv Warden (Quarkus).
 *
 * Uses Google's OSV.dev database — the broadest open advisory source, covering
 * many ecosystems, transitive dependencies, and malicious-package advisories —
 * and ingests the resolved packages and vulnerabilities through the SCA path.
 */
@CommandLine.Command(name = "osv", mixinStandardHelpOptions = true,
        description = "Run osv-scanner (OSV.dev SCA) and report dependencies to Techanv Warden.")
public class OsvCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String output = "/tmp/osv.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("osv-scanner", "Dependency", project);
        } catch (Exception e) {
            System.err.println("[osv] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = List.of("osv-scanner", "--format", "json", "--output", output, "-r", project);
            System.out.println("[osv] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd).redirectErrorStream(false).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();
            // osv-scanner: 0 = no vulns, 1 = vulns found; both are successful runs.
            if (code != 0 && code != 1) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank() ? "osv-scanner failed (exit " + code + ")"
                        : t.substring(Math.max(0, t.length() - 500)));
            }

            Map<String, PackageInfo> packages = new LinkedHashMap<>();
            List<VulnerabilityInfo> vulns = new ArrayList<>();
            Path report = Path.of(output);
            if (Files.exists(report) && Files.size(report) > 0) {
                JsonNode root = MAPPER.readTree(Files.readAllBytes(report));
                for (JsonNode result : root.path("results")) {
                    String source = result.path("source").path("path").asText("");
                    for (JsonNode entry : result.path("packages")) {
                        JsonNode pkg = entry.path("package");
                        String name = pkg.path("name").asText("unknown");
                        String version = pkg.path("version").asText("unknown");
                        String ecosystem = pkg.path("ecosystem").asText("unknown");
                        String pkgId = "pkg:" + ecosystem.toLowerCase() + "/" + name + "@" + version;
                        packages.putIfAbsent(pkgId,
                                new PackageInfo(pkgId, name, version, ecosystem, source.isBlank() ? null : source));

                        String groupSeverity = maxGroupSeverity(entry.path("groups"));
                        for (JsonNode v : entry.path("vulnerabilities")) {
                            VulnerabilityInfo vi = new VulnerabilityInfo();
                            vi.identity = v.path("id").asText("unknown");
                            vi.name = firstNonBlank(v.path("summary").asText(""), v.path("id").asText("unknown"));
                            String d = firstNonBlank(v.path("details").asText(""), v.path("summary").asText(""), vi.identity);
                            vi.description = d.length() > 4000 ? d.substring(0, 4000) : d;
                            vi.fixedVersion = fixedVersion(v, name);
                            vi.severity = severityOf(v, groupSeverity);
                            vi.pkgId = pkgId;
                            vi.pkgName = name;
                            vi.publishedAt = v.has("published") ? v.path("published").asText(null) : null;
                            vulns.add(vi);
                        }
                    }
                }
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
            System.err.println("[osv] failed: " + exc.getMessage());
            return 1;
        }
    }

    /** OSV database_specific severity (HIGH/MODERATE/…) takes priority, else CVSS bucket. */
    private static String severityOf(JsonNode vuln, String groupCvss) {
        String dbSev = vuln.path("database_specific").path("severity").asText("").toUpperCase();
        switch (dbSev) {
            case "CRITICAL": return "Critical";
            case "HIGH": return "High";
            case "MODERATE": case "MEDIUM": return "Medium";
            case "LOW": return "Low";
            default: break;
        }
        return bucket(groupCvss);
    }

    private static String maxGroupSeverity(JsonNode groups) {
        double max = -1;
        for (JsonNode g : groups) {
            double s = parse(g.path("max_severity").asText(""));
            if (s > max) max = s;
        }
        return max >= 0 ? String.valueOf(max) : "";
    }

    private static String bucket(String cvss) {
        double s = parse(cvss);
        if (s >= 9.0) return "Critical";
        if (s >= 7.0) return "High";
        if (s >= 4.0) return "Medium";
        if (s > 0) return "Low";
        return "Info";
    }

    private static String fixedVersion(JsonNode vuln, String pkgName) {
        for (JsonNode affected : vuln.path("affected")) {
            if (!affected.path("package").path("name").asText("").equals(pkgName)) continue;
            for (JsonNode range : affected.path("ranges")) {
                for (JsonNode ev : range.path("events")) {
                    String fixed = ev.path("fixed").asText("");
                    if (!fixed.isBlank()) return fixed;
                }
            }
        }
        return "";
    }

    private static double parse(String s) {
        try {
            return Double.parseDouble(s.strip());
        } catch (Exception e) {
            return -1;
        }
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
