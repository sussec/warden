package com.techanv.warden.scanner.nikto;

import java.io.File;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.Env;
import com.techanv.warden.client.WardenClient;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;

import picocli.CommandLine;

/**
 * Nikto web-server scanner (DAST) analyzer for Techanv Warden (Quarkus port).
 *
 * Nikto probes a live HTTP(S) target for dangerous files, misconfigurations,
 * and outdated server software. Its JSON report is a one-element-per-host
 * array; findings live under {@code vulnerabilities[]} with keys {@code id},
 * {@code msg}, {@code url}, {@code method}, {@code references}. Nikto emits no
 * severity, so we bucket to Medium (it only reports actionable issues) and let
 * Warden's triage refine — except the X-* header/info checks which are Info.
 *
 * Optional environment:
 *   NIKTO_TUNING    Nikto -Tuning string (e.g. "x6" to skip DoS); default all tests
 *   NIKTO_MAXTIME   Max testing time per host (e.g. "600s", "10m"); default unset
 */
@CommandLine.Command(name = "nikto", mixinStandardHelpOptions = true,
        description = "Run Nikto (web server DAST) against a target URL and report to Techanv Warden.")
public class NiktoCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Integer call() {
        String target = Env.get("TARGET_URL", "");
        if (target.isBlank()) {
            System.err.println("[nikto] missing required environment variable TARGET_URL");
            return 2;
        }
        String output = "/tmp/nikto.json";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("nikto", "Dast", "/tmp", host(target));
        } catch (Exception e) {
            System.err.println("[nikto] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            // -host/-Format json/-output is the canonical non-interactive form;
            // -ask no suppresses the update prompt, -nointeractive avoids any TTY wait.
            List<String> cmd = new ArrayList<>(List.of(
                    "nikto", "-host", target, "-Format", "json", "-output", output,
                    "-nointeractive", "-ask", "no"));
            String tuning = Env.get("NIKTO_TUNING", "");
            if (!tuning.isBlank()) {
                cmd.add("-Tuning");
                cmd.add(tuning);
            }
            String maxtime = Env.get("NIKTO_MAXTIME", "");
            if (!maxtime.isBlank()) {
                cmd.add("-maxtime");
                cmd.add(maxtime);
            }
            System.out.println("[nikto] " + String.join(" ", cmd));
            // Nikto exits non-zero in normal operation; success is judged by a
            // parseable report, like the cve-lite wrapper. Discard stdout (the
            // progress table) so a full pipe buffer cannot deadlock.
            Process run = new ProcessBuilder(cmd)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectErrorStream(false).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();

            File report = new File(output);
            if (!report.exists() || report.length() == 0) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank() ? "nikto produced no report (exit " + code + ")"
                        : t.substring(Math.max(0, t.length() - 500)));
            }

            List<Finding> findings = new ArrayList<>();
            JsonNode root = MAPPER.readTree(Files.readAllBytes(Path.of(output)));
            // Top level is an array of host objects; tolerate a single object too.
            List<JsonNode> hosts = new ArrayList<>();
            if (root.isArray()) {
                root.forEach(hosts::add);
            } else if (root.isObject()) {
                hosts.add(root);
            }
            for (JsonNode hostNode : hosts) {
                String hostName = firstNonBlank(hostNode.path("host").asText(""), host(target));
                for (JsonNode v : hostNode.path("vulnerabilities")) {
                    String id = v.path("id").asText("");
                    String url = v.path("url").asText("/");
                    String method = v.path("method").asText("GET");
                    String msg = firstNonBlank(v.path("msg").asText(""), "Nikto finding");
                    String refs = v.path("references").asText("");

                    Finding f = new Finding();
                    f.identity = "nikto:" + id + ":" + method + ":" + url;
                    f.ruleId = id;
                    f.name = truncate(msg, 200);
                    f.description = refs.isBlank() ? msg : msg + "\n\nReferences: " + refs;
                    f.severity = severityOf(msg);
                    FindingLocation loc = new FindingLocation();
                    loc.path = absoluteUrl(target, hostName, url, method);
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
            System.err.println("[nikto] failed: " + exc.getMessage());
            return 1;
        }
    }

    /**
     * Nikto carries no severity field. Pure information-disclosure header checks
     * are Info; everything else Nikto reports is an actionable misconfiguration,
     * so default to Medium and let Warden triage adjust.
     */
    private static String severityOf(String msg) {
        String m = msg.toLowerCase();
        if (m.contains("x-frame-options") || m.contains("x-content-type-options")
                || m.contains("x-xss-protection") || m.contains("strict-transport-security")
                || m.contains("content-security-policy") || m.contains("header")) {
            return "Info";
        }
        if (m.contains("sql inject") || m.contains("remote code") || m.contains("command exec")
                || m.contains("shell") || m.contains("rce")) {
            return "High";
        }
        return "Medium";
    }

    private static String absoluteUrl(String target, String hostName, String url, String method) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return method + " " + url;
        }
        String base = target.endsWith("/") ? target.substring(0, target.length() - 1) : target;
        return method + " " + base + (url.startsWith("/") ? url : "/" + url);
    }

    private static String host(String url) {
        try {
            String h = URI.create(url).getHost();
            return h != null ? h : url;
        } catch (Exception e) {
            return url;
        }
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
