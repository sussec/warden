package com.techanv.warden.scanner.kubescape;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.Env;
import com.techanv.warden.client.WardenClient;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;

import picocli.CommandLine;

/**
 * Kubescape (ARMO/CNCF) Kubernetes-posture scanner for Techanv Warden (Quarkus).
 *
 * Scans Kubernetes manifests in a source checkout (no live cluster) against a
 * misconfiguration framework (NSA/MITRE/CIS) via OPA Rego controls. A finding is
 * a failed control on a resource. The v2 JSON report keeps per-control severity
 * under {@code summaryDetails.controls} (by control id) while the per-resource
 * {@code results} only carry the control id/status, so we join the two; the
 * resource manifest path comes from {@code resources[].source.relativePath}.
 *
 * Optional environment:
 *   KUBESCAPE_FRAMEWORK   framework to run (nsa | mitre | cis | ...); default nsa
 *   KUBESCAPE_ARGS        extra raw args appended to the CLI
 */
@CommandLine.Command(name = "kubescape", mixinStandardHelpOptions = true,
        description = "Run kubescape (K8s manifest posture) and report findings to Techanv Warden.")
public class KubescapeCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String output = "/tmp/kubescape.json";
        String framework = Env.get("KUBESCAPE_FRAMEWORK", "nsa");
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("kubescape", "Sast", project);
        } catch (Exception e) {
            System.err.println("[kubescape] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = new ArrayList<>(List.of(
                    "kubescape", "scan", "framework", framework,
                    "--format", "json", "--format-version", "v2",
                    "--output", output));
            String extra = Env.get("KUBESCAPE_ARGS", "");
            if (!extra.isBlank()) {
                for (String a : extra.trim().split("\\s+")) cmd.add(a);
            }
            cmd.add(project);
            System.out.println("[kubescape] " + String.join(" ", cmd));
            // kubescape exits 0 by default regardless of findings; a non-zero exit
            // is an operational error, so success is judged by a parseable report.
            Process run = new ProcessBuilder(cmd)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectErrorStream(false).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();

            Path reportPath = Path.of(output);
            if (!Files.exists(reportPath) || Files.size(reportPath) == 0) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank()
                        ? "kubescape produced no report (exit " + code + ")"
                        : t.substring(Math.max(0, t.length() - 700)));
            }

            JsonNode root = MAPPER.readTree(Files.readAllBytes(reportPath));

            // Index control metadata (severity) and resources (manifest path/kind).
            Map<String, JsonNode> controls = new HashMap<>();
            JsonNode controlsNode = root.path("summaryDetails").path("controls");
            controlsNode.fields().forEachRemaining(e -> controls.put(e.getKey(), e.getValue()));
            Map<String, JsonNode> resources = new HashMap<>();
            for (JsonNode r : root.path("resources")) {
                resources.put(r.path("resourceID").asText(""), r);
            }

            List<Finding> findings = new ArrayList<>();
            Set<String> seen = new LinkedHashSet<>();
            for (JsonNode result : root.path("results")) {
                String resourceId = result.path("resourceID").asText("");
                JsonNode resource = resources.getOrDefault(resourceId, MAPPER.missingNode());
                for (JsonNode ctrl : result.path("controls")) {
                    if (!"failed".equals(ctrl.path("status").path("status").asText(""))) continue;
                    String controlId = ctrl.path("controlID").asText("");
                    String name = ctrl.path("name").asText(controlId);

                    String identity = "kubescape:" + controlId + ":" + resourceId;
                    if (!seen.add(identity)) continue;

                    Finding f = new Finding();
                    f.identity = identity;
                    f.ruleId = controlId;
                    f.name = name;
                    f.description = describe(controlId, name, resource, controls.get(controlId));
                    f.category = controlId;
                    f.severity = severityOf(controls.get(controlId));
                    FindingLocation loc = new FindingLocation();
                    loc.path = locationOf(resource, resourceId);
                    f.location = loc;
                    findings.add(f);
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
            System.err.println("[kubescape] failed: " + exc.getMessage());
            return 1;
        }
    }

    /** Severity from the control's scoreFactor/baseScore (0–10). */
    private static String severityOf(JsonNode control) {
        if (control == null) return "Medium";
        double score = control.path("scoreFactor").asDouble(control.path("baseScore").asDouble(-1));
        if (score >= 9) return "Critical";
        if (score >= 7) return "High";
        if (score >= 4) return "Medium";
        if (score >= 0) return "Low";
        return "Medium";
    }

    /** Prefer the manifest file path; else the resource id (kind/name/namespace). */
    private static String locationOf(JsonNode resource, String resourceId) {
        String rel = resource.path("source").path("relativePath").asText("");
        if (!rel.isBlank()) {
            JsonNode obj = resource.path("object");
            String kind = obj.path("kind").asText("");
            String rname = obj.path("metadata").path("name").asText(obj.path("name").asText(""));
            return rel + (kind.isBlank() ? "" : " · " + kind + (rname.isBlank() ? "" : "/" + rname));
        }
        return resourceId.isBlank() ? "manifest" : resourceId;
    }

    private static String describe(String controlId, String name, JsonNode resource, JsonNode control) {
        StringBuilder sb = new StringBuilder();
        sb.append(controlId).append(" — ").append(name).append('.');
        JsonNode obj = resource.path("object");
        String kind = obj.path("kind").asText("");
        String rname = obj.path("metadata").path("name").asText(obj.path("name").asText(""));
        String ns = obj.path("metadata").path("namespace").asText("");
        if (!kind.isBlank()) {
            sb.append("\n\nResource: ").append(kind);
            if (!rname.isBlank()) sb.append('/').append(rname);
            if (!ns.isBlank()) sb.append(" (namespace ").append(ns).append(')');
        }
        if (control != null) {
            String desc = control.path("description").asText("");
            if (!desc.isBlank()) sb.append("\n\n").append(desc);
            String remediation = control.path("remediation").asText("");
            if (!remediation.isBlank()) sb.append("\n\nRemediation: ").append(remediation);
        }
        String d = sb.toString();
        return d.length() > 4000 ? d.substring(0, 4000) : d;
    }
}
