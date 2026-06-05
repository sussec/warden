package com.techanv.warden.scanner.zap;

import java.io.File;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.Env;
import com.techanv.warden.client.WardenClient;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;

import picocli.CommandLine;

/** OWASP ZAP baseline DAST analyzer for Techanv Warden (Quarkus port). */
@CommandLine.Command(name = "zap", mixinStandardHelpOptions = true,
        description = "Run zap-baseline against a target URL and report to Techanv Warden.")
public class ZapCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Map<Integer, String> SEVERITY = Map.of(3, "High", 2, "Medium", 1, "Low", 0, "Info");
    private static final Pattern TAG = Pattern.compile("<[^>]+>");
    private static final Pattern WS = Pattern.compile("\\s+");

    @Override
    public Integer call() {
        String target = System.getenv("TARGET_URL");
        if (target == null || target.isBlank()) {
            System.err.println("[zap] missing required environment variable TARGET_URL");
            return 2;
        }
        String workDir = "/zap/wrk";
        String reportName = "zap.json";
        String output = workDir + "/" + reportName;
        try {
            Files.createDirectories(Path.of(workDir));
        } catch (Exception ignore) {
            // continue
        }
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("zap", "Dast", "/tmp", host(target));
        } catch (Exception e) {
            System.err.println("[zap] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = List.of("zap-baseline.py", "-t", target, "-J", reportName, "-I");
            System.out.println("[zap] " + String.join(" ", cmd));
            Process run = new ProcessBuilder(cmd).directory(new File(workDir)).redirectErrorStream(true).start();
            String out = new String(run.getInputStream().readAllBytes());
            run.waitFor(); // zap-baseline exits non-zero by design; rely on the report

            File report = new File(output);
            if (!report.exists()) {
                String tail = out.strip();
                throw new RuntimeException("zap-baseline produced no report. "
                        + (tail.length() > 400 ? tail.substring(tail.length() - 400) : tail));
            }

            JsonNode root = MAPPER.readTree(Files.readAllBytes(Path.of(output)));
            List<Finding> findings = new ArrayList<>();
            for (JsonNode site : root.path("site")) {
                for (JsonNode alert : site.path("alerts")) {
                    String plugin = alert.path("pluginid").asText("");
                    int risk = parseInt(alert.path("riskcode").asText("0"));
                    String cwe = alert.path("cweid").asText("");
                    String category = (cwe.equals("-1") || cwe.isBlank() || cwe.equals("None")) ? null : "CWE-" + cwe;
                    String desc = stripHtml(alert.path("desc").asText(""));
                    String solution = stripHtml(alert.path("solution").asText(""));
                    String description = solution.isBlank() ? desc : (desc + "\n\nSolution: " + solution).strip();
                    String name = firstNonBlank(alert.path("alert").asText(""), alert.path("name").asText(""), "ZAP alert");

                    JsonNode instances = alert.path("instances");
                    if (!instances.isArray() || instances.isEmpty()) {
                        findings.add(makeFinding(plugin, target, name, description, category, risk));
                    } else {
                        for (JsonNode inst : instances) {
                            String uri = firstNonBlank(inst.path("uri").asText(""), target);
                            findings.add(makeFinding(plugin, uri, name, description, category, risk));
                        }
                    }
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
            System.err.println("[zap] failed: " + exc.getMessage());
            return 1;
        }
    }

    private static Finding makeFinding(String plugin, String uri, String name, String desc, String category, int risk) {
        Finding f = new Finding();
        f.identity = "zap:" + plugin + ":" + uri;
        f.ruleId = plugin;
        f.name = name;
        f.description = desc.isBlank() ? name : desc;
        f.category = category;
        f.severity = SEVERITY.getOrDefault(risk, "Info");
        FindingLocation loc = new FindingLocation();
        loc.path = uri;
        f.location = loc;
        return f;
    }

    private static String stripHtml(String s) {
        if (s == null || s.isBlank()) return "";
        return WS.matcher(TAG.matcher(s).replaceAll(" ")).replaceAll(" ").strip();
    }

    private static String host(String url) {
        try {
            String h = URI.create(url).getHost();
            return h != null ? h : url;
        } catch (Exception e) {
            return url;
        }
    }

    private static int parseInt(String s) {
        try {
            return Integer.parseInt(s.strip());
        } catch (Exception e) {
            return 0;
        }
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
