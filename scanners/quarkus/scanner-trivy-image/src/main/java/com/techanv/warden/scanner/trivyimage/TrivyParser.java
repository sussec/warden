package com.techanv.warden.scanner.trivyimage;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.techanv.warden.client.model.PackageInfo;
import com.techanv.warden.client.model.VulnerabilityInfo;

/** Shared trivy JSON → packages/vulnerabilities mapping (image report). */
public final class TrivyParser {
    private static final Map<String, String> SEVERITY = Map.of(
            "CRITICAL", "Critical", "HIGH", "High", "MEDIUM", "Medium", "LOW", "Low", "UNKNOWN", "Info");

    private TrivyParser() {}

    public static void parse(JsonNode report, Map<String, PackageInfo> packages, List<VulnerabilityInfo> vulns) {
        for (JsonNode result : report.path("Results")) {
            String target = result.path("Target").asText("");
            String type = result.path("Type").asText("unknown");
            for (JsonNode pkg : result.path("Packages")) {
                String name = pkg.path("Name").asText("unknown");
                String version = pkg.path("Version").asText("unknown");
                String pkgId = purl(pkg.path("Identifier").path("PURL").asText(""), name, version);
                packages.putIfAbsent(pkgId, new PackageInfo(pkgId, name, version, type, target.isBlank() ? null : target));
            }
            for (JsonNode v : result.path("Vulnerabilities")) {
                String name = v.path("PkgName").asText("unknown");
                String version = v.path("InstalledVersion").asText("unknown");
                String pkgId = purl(v.path("PkgIdentifier").path("PURL").asText(""), name, version);
                packages.putIfAbsent(pkgId, new PackageInfo(pkgId, name, version, type, target.isBlank() ? null : target));

                VulnerabilityInfo vi = new VulnerabilityInfo();
                vi.identity = v.path("VulnerabilityID").asText("unknown");
                vi.name = firstNonBlank(v.path("Title").asText(""), v.path("VulnerabilityID").asText("unknown"));
                String d = v.path("Description").asText("");
                vi.description = d.length() > 4000 ? d.substring(0, 4000) : d;
                vi.fixedVersion = v.path("FixedVersion").asText("");
                vi.severity = SEVERITY.getOrDefault(v.path("Severity").asText(""), "Info");
                vi.pkgId = pkgId;
                vi.pkgName = name;
                vi.publishedAt = v.has("PublishedDate") ? v.path("PublishedDate").asText(null) : null;
                vulns.add(vi);
            }
        }
    }

    private static String purl(String purl, String name, String version) {
        return (purl != null && !purl.isBlank()) ? purl : "pkg:generic/" + name + "@" + version;
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
