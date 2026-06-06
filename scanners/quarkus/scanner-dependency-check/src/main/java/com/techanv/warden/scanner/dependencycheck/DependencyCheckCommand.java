package com.techanv.warden.scanner.dependencycheck;

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
 * OWASP Dependency-Check SCA analyzer for Techanv Warden (Quarkus port).
 *
 * Dependency-Check identifies project dependencies and matches them to known
 * CVEs via CPE/NVD. Its JSON report nests vulnerabilities under each entry of
 * {@code dependencies[]}; we flatten that into Warden's package + vulnerability
 * model. CVE id is {@code vulnerabilities[].name}; severity {@code .severity}.
 *
 * An NVD API key is strongly recommended — without it the NVD data download is
 * extremely slow. Provide it via NVD_API_KEY; the data cache should be a
 * persistent volume so repeated scans do not re-download the NVD.
 *
 * Optional environment:
 *   NVD_API_KEY                 NVD API key (https://nvd.nist.gov/developers/request-an-api-key)
 *   DEPENDENCY_CHECK_NOUPDATE   "true" — skip the NVD/data auto-update (use cached data)
 *   DEPENDENCY_CHECK_ARGS       extra raw args appended to the CLI (space-separated)
 */
@CommandLine.Command(name = "dependency-check", mixinStandardHelpOptions = true,
        description = "Run OWASP Dependency-Check (SCA) and report dependencies to Techanv Warden.")
public class DependencyCheckCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String outDir = "/tmp/odc";
        String report = outDir + "/dependency-check-report.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("dependency-check", "Dependency", project);
        } catch (Exception e) {
            System.err.println("[dependency-check] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            Files.createDirectories(Path.of(outDir));
            List<String> cmd = new ArrayList<>(List.of(
                    "dependency-check.sh", "--scan", project, "--format", "JSON",
                    "--out", outDir, "--project", "warden-scan", "--prettyPrint"));
            String apiKey = Env.get("NVD_API_KEY", "");
            if (!apiKey.isBlank()) {
                cmd.add("--nvdApiKey");
                cmd.add(apiKey);
            }
            if (Env.get("DEPENDENCY_CHECK_NOUPDATE", "").equalsIgnoreCase("true")) {
                cmd.add("--noupdate");
            }
            String extra = Env.get("DEPENDENCY_CHECK_ARGS", "");
            if (!extra.isBlank()) {
                for (String a : extra.trim().split("\\s+")) cmd.add(a);
            }
            System.out.println("[dependency-check] " + String.join(" ", cmd));
            // Discard stdout (verbose progress) to avoid a pipe-buffer deadlock;
            // keep stderr for diagnostics. The report file decides success.
            Process run = new ProcessBuilder(cmd)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectErrorStream(false).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();

            Path reportPath = Path.of(report);
            if (!Files.exists(reportPath) || Files.size(reportPath) == 0) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank()
                        ? "dependency-check produced no report (exit " + code + ")"
                        : t.substring(Math.max(0, t.length() - 800)));
            }

            Map<String, PackageInfo> packages = new LinkedHashMap<>();
            List<VulnerabilityInfo> vulns = new ArrayList<>();
            JsonNode root = MAPPER.readTree(Files.readAllBytes(reportPath));
            for (JsonNode dep : root.path("dependencies")) {
                JsonNode vulnerabilities = dep.path("vulnerabilities");
                if (!vulnerabilities.isArray() || vulnerabilities.isEmpty()) {
                    continue; // only ingest dependencies that actually carry CVEs
                }
                String fileName = dep.path("fileName").asText("unknown");
                String filePath = dep.path("filePath").asText(null);
                JsonNode pkgs = dep.path("packages");
                String pkgId = pkgs.isArray() && !pkgs.isEmpty()
                        ? pkgs.get(0).path("id").asText("") : "";
                String name = nameFromPurl(pkgId, fileName);
                String version = versionFromPurl(pkgId);
                if (pkgId.isBlank()) {
                    pkgId = "pkg:generic/" + name + "@" + version;
                }
                String type = typeFromPurl(pkgId);
                packages.putIfAbsent(pkgId, new PackageInfo(pkgId, name, version, type, filePath));

                for (JsonNode v : vulnerabilities) {
                    VulnerabilityInfo vi = new VulnerabilityInfo();
                    vi.identity = v.path("name").asText("unknown");
                    vi.name = vi.identity;
                    String d = v.path("description").asText("");
                    vi.description = d.isBlank() ? vi.identity : truncate(d, 4000);
                    vi.fixedVersion = "";
                    vi.severity = mapSeverity(v);
                    vi.pkgId = pkgId;
                    vi.pkgName = name;
                    vi.publishedAt = null;
                    vulns.add(vi);
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
            System.err.println("[dependency-check] failed: " + exc.getMessage());
            return 1;
        }
    }

    /** Prefer the textual severity; fall back to bucketing the CVSS v3/v2 score. */
    private static String mapSeverity(JsonNode v) {
        String s = v.path("severity").asText("").toUpperCase();
        switch (s) {
            case "CRITICAL": return "Critical";
            case "HIGH": return "High";
            case "MEDIUM": case "MODERATE": return "Medium";
            case "LOW": return "Low";
            default:
                double score = v.path("cvssv3").path("baseScore").asDouble(
                        v.path("cvssv2").path("score").asDouble(-1));
                if (score >= 9) return "Critical";
                if (score >= 7) return "High";
                if (score >= 4) return "Medium";
                if (score > 0) return "Low";
                return "Info";
        }
    }

    // purl shape: pkg:maven/group/artifact@version  or  pkg:npm/name@version
    private static String nameFromPurl(String purl, String fallback) {
        if (purl.isBlank()) return stripVersion(fallback);
        String body = purl.contains("/") ? purl.substring(purl.indexOf('/') + 1) : purl;
        int at = body.indexOf('@');
        return at >= 0 ? body.substring(0, at) : body;
    }

    private static String versionFromPurl(String purl) {
        int at = purl.indexOf('@');
        if (at < 0) return "unknown";
        String v = purl.substring(at + 1);
        int q = v.indexOf('?');
        return q >= 0 ? v.substring(0, q) : v;
    }

    private static String typeFromPurl(String purl) {
        if (purl.startsWith("pkg:")) {
            String rest = purl.substring(4);
            int slash = rest.indexOf('/');
            return slash > 0 ? rest.substring(0, slash) : "generic";
        }
        return "generic";
    }

    private static String stripVersion(String fileName) {
        return fileName.replaceAll("[-_]\\d.*$", "").replaceAll("\\.(jar|war|whl|gem|tgz|zip)$", "");
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }
}
