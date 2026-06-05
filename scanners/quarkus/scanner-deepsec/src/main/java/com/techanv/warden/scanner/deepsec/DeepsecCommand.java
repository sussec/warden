package com.techanv.warden.scanner.deepsec;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.Env;
import com.techanv.warden.client.WardenClient;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;

import picocli.CommandLine;

/**
 * deepsec AI-agent SAST analyzer for Techanv Warden (Quarkus).
 *
 * deepsec (vercel-labs) runs ~110 regex matchers to flag security-sensitive
 * files, then dispatches coding agents (Claude / GPT) to trace data flow and
 * confirm exploitable vulnerabilities — catching logic and data-flow bugs that
 * pattern-based SAST misses, including in AI-generated code.
 *
 * <p>Two modes:
 * <ul>
 *   <li><b>Pipeline</b> (default): runs {@code deepsec scan → process → export},
 *       wired to Warden's own AI configuration ({@code AI_ENDPOINT},
 *       {@code AI_MODEL}, {@code WARDEN_AI_API_KEY}) so the model endpoint is a
 *       single source of truth. The AI step costs money and takes minutes—hours;
 *       {@code DEEPSEC_LIMIT} budget-caps the number of files investigated.</li>
 *   <li><b>Bridge</b> ({@code DEEPSEC_REPORT=/path/to/findings.json}): ingests an
 *       existing {@code deepsec export --format json} produced elsewhere
 *       (typically a CI job, where cost and time are acceptable). No AI calls.</li>
 * </ul>
 */
@CommandLine.Command(name = "deepsec", mixinStandardHelpOptions = true,
        description = "Run deepsec (AI-agent SAST) and report findings to Techanv Warden.")
public class DeepsecCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String REPORT = "/tmp/deepsec.json";
    private static final Map<String, String> SEVERITY = Map.of(
            "CRITICAL", "Critical", "HIGH", "High", "HIGH_BUG", "High",
            "MEDIUM", "Medium", "BUG", "Low", "LOW", "Low");

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("deepsec", "Sast", project);
        } catch (Exception e) {
            System.err.println("[deepsec] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            String reportPath = bridgeReport();
            if (reportPath == null) {
                // Pipeline mode — needs a model endpoint (reuse Warden's AI config).
                String base = aiBaseUrl();
                String key = aiKey();
                if (base.isBlank() || key.isBlank()) {
                    String msg = "deepsec needs an AI endpoint — set Warden AI (AI_ENDPOINT + "
                            + "WARDEN_AI_API_KEY) or run deepsec in CI and pass DEEPSEC_REPORT";
                    client.completeScan(scanId, msg);
                    System.err.println("[deepsec] " + msg);
                    return 2;
                }
                runPipeline(project, base, key);
                reportPath = REPORT;
            } else {
                System.out.println("[deepsec] bridge mode — ingesting " + reportPath);
            }

            List<Finding> findings = parse(reportPath, project);
            client.uploadFindings(scanId, findings);
            client.completeScan(scanId, null);
            return 0;
        } catch (Exception exc) {
            try {
                client.completeScan(scanId, exc.getMessage());
            } catch (Exception ignore) {
                // best effort
            }
            System.err.println("[deepsec] failed: " + exc.getMessage());
            return 1;
        }
    }

    // ---- pipeline ------------------------------------------------------------

    private void runPipeline(String project, String aiBase, String aiKey) throws Exception {
        String work = "/work";
        Files.createDirectories(Path.of(work));
        String agent = Env.get("DEEPSEC_AGENT", "codex");      // OpenAI-flavored loop
        String model = Env.get("DEEPSEC_MODEL", Env.get("AI_MODEL", "gpt-5.5"));
        String limit = Env.get("DEEPSEC_LIMIT", "50");          // budget cap (files)
        String concurrency = Env.get("DEEPSEC_CONCURRENCY", "3");

        // deepsec routes the OpenAI-flavored agent through OPENAI_BASE_URL/KEY,
        // and the Claude agent through ANTHROPIC_*. Point both at Warden's AI.
        Map<String, String> aiEnv = Map.of(
                "OPENAI_BASE_URL", aiBase,
                "OPENAI_API_KEY", aiKey,
                "ANTHROPIC_BASE_URL", aiBase,
                "ANTHROPIC_AUTH_TOKEN", aiKey);

        exec(work, aiEnv, "deepsec", "init");
        exec(work, aiEnv, "deepsec", "scan", "--root", project);
        exec(work, aiEnv, "deepsec", "process", "--root", project,
                "--agent", agent, "--model", model, "--limit", limit, "--concurrency", concurrency);
        if ("true".equalsIgnoreCase(Env.get("DEEPSEC_REVALIDATE", "false"))) {
            exec(work, aiEnv, "deepsec", "revalidate", "--root", project, "--agent", agent, "--model", model);
        }
        exec(work, aiEnv, "deepsec", "export", "--root", project, "--format", "json", "--out", REPORT);
    }

    private static void exec(String cwd, Map<String, String> extraEnv, String... cmd) throws Exception {
        System.out.println("[deepsec] " + String.join(" ", cmd));
        ProcessBuilder pb = new ProcessBuilder(cmd).directory(new File(cwd)).inheritIO();
        pb.environment().putAll(extraEnv);
        Process p = pb.start();
        int code = p.waitFor();
        if (code != 0) {
            throw new RuntimeException(cmd[0] + " " + cmd[1] + " exited " + code);
        }
    }

    // ---- parsing -------------------------------------------------------------

    private static List<Finding> parse(String reportPath, String project) throws Exception {
        List<Finding> findings = new ArrayList<>();
        Path p = Path.of(reportPath);
        if (!Files.exists(p) || Files.size(p) == 0) {
            return findings;
        }
        JsonNode root = MAPPER.readTree(Files.readAllBytes(p));
        for (JsonNode f : root) { // export --format json is an array of ExportedFinding
            JsonNode meta = f.path("metadata");
            String filePath = relativize(meta.path("filePath").asText(""), project);
            JsonNode lines = meta.path("lineNumbers");
            Integer start = lines.isArray() && lines.size() > 0 ? lines.get(0).asInt() : null;
            Integer end = lines.isArray() && lines.size() > 0 ? lines.get(lines.size() - 1).asInt() : start;
            String slug = meta.path("vulnSlug").asText("finding");

            Finding finding = new Finding();
            finding.identity = "deepsec:" + slug + ":" + filePath + ":" + start;
            finding.ruleId = slug;
            finding.name = f.path("title").asText(slug);
            String desc = f.path("description").asText("");
            String verdict = meta.path("revalidation").path("verdict").asText("");
            String reasoning = meta.path("revalidation").path("reasoning").asText("");
            if (!verdict.isBlank()) {
                desc = desc + "\n\n_Revalidation: " + verdict
                        + (reasoning.isBlank() ? "" : " — " + reasoning) + "_";
            }
            String confidence = meta.path("confidence").asText("");
            if (!confidence.isBlank()) desc = desc + "\n\n_Confidence: " + confidence + "_";
            finding.description = desc.isBlank() ? finding.name : desc;
            finding.category = slug;
            finding.severity = SEVERITY.getOrDefault(
                    f.path("severity").asText("").toUpperCase(), "Medium");

            FindingLocation loc = new FindingLocation();
            loc.path = filePath.isBlank() ? null : filePath;
            loc.startLine = start != null && start > 0 ? start : null;
            loc.endLine = end != null && end > 0 ? end : null;
            finding.location = loc;
            findings.add(finding);
        }
        return findings;
    }

    // ---- helpers -------------------------------------------------------------

    /** Reuse Warden's AI endpoint as the deepsec model gateway (single source of truth). */
    private static String aiBaseUrl() {
        return firstNonBlank(System.getenv("DEEPSEC_OPENAI_BASE_URL"), System.getenv("AI_ENDPOINT"),
                System.getenv("OPENAI_BASE_URL"));
    }

    private static String aiKey() {
        return firstNonBlank(System.getenv("DEEPSEC_API_KEY"), System.getenv("WARDEN_AI_API_KEY"),
                System.getenv("OPENAI_API_KEY"), System.getenv("ANTHROPIC_AUTH_TOKEN"));
    }

    private static String bridgeReport() {
        String r = System.getenv("DEEPSEC_REPORT");
        return (r != null && !r.isBlank() && new File(r).isFile()) ? r : null;
    }

    private static String relativize(String file, String project) {
        if (file == null || file.isBlank()) return "";
        try {
            if (!file.startsWith("/")) return file; // deepsec already emits repo-relative paths
            return Path.of(project).toAbsolutePath().relativize(Path.of(file).toAbsolutePath()).toString();
        } catch (Exception e) {
            return file;
        }
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
