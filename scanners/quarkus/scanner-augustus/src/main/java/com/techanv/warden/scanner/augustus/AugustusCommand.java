package com.techanv.warden.scanner.augustus;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
 * Augustus LLM red-team scanner (Praetorian) for Techanv Warden (Quarkus port).
 *
 * Augustus probes a target LLM (or any OpenAI-compatible / custom REST endpoint)
 * with adversarial prompts — jailbreaks, prompt injection, encoding exploits,
 * data extraction — and a detector scores each response. It emits one JSONL
 * object per probe-attempt with fields {@code probe}, {@code detector},
 * {@code scores} (float array, 1.0 = vulnerable), {@code passed} (false ==
 * vulnerable), {@code status}, {@code prompt}, {@code response}.
 *
 * We ingest only the VULNERABLE attempts ({@code passed:false}) as Warden
 * findings under the {@code Ai} scanner category, deduplicated per
 * probe+detector. Augustus exits 0 even when vulnerabilities are found, so —
 * like the nuclei/nikto wrappers — success is judged by a parseable report.
 *
 * Environment:
 *   AUGUSTUS_GENERATOR   required — generator name, e.g. "rest.Rest",
 *                        "openai.OpenAI", "anthropic.Anthropic", or "test.Repeat"
 *   AUGUSTUS_CONFIG      generator config JSON (rest.Rest endpoint, model, …),
 *                        passed verbatim to --config
 *   AUGUSTUS_PROBES      probe glob(s); default a jailbreak/injection starter set;
 *                        set "ALL" to run every registered probe
 *   AUGUSTUS_DETECTORS   detector glob(s); default "*"
 *   AUGUSTUS_ARGS        extra raw args appended to the CLI (space-separated)
 */
@CommandLine.Command(name = "augustus", mixinStandardHelpOptions = true,
        description = "Run Augustus (LLM red-team / GenAI security) and report to Techanv Warden.")
public class AugustusCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String DEFAULT_PROBES = "dan.*,encoding.*,promptinject.*,goodside.*";

    @Override
    public Integer call() {
        String generator = Env.get("AUGUSTUS_GENERATOR", "");
        if (generator.isBlank()) {
            System.err.println("[augustus] missing required environment variable AUGUSTUS_GENERATOR "
                    + "(e.g. rest.Rest, openai.OpenAI, test.Repeat)");
            return 2;
        }
        String output = "/tmp/augustus.jsonl";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("augustus", "Ai", "/tmp", targetLabel(generator));
        } catch (Exception e) {
            System.err.println("[augustus] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            List<String> cmd = new ArrayList<>(List.of("augustus", "scan", generator,
                    "--format", "jsonl", "--output", output));
            String probes = Env.get("AUGUSTUS_PROBES", DEFAULT_PROBES);
            if (probes.equalsIgnoreCase("ALL")) {
                cmd.add("--all");
            } else {
                cmd.add("--probes-glob");
                cmd.add(probes);
            }
            cmd.add("--detectors-glob");
            cmd.add(Env.get("AUGUSTUS_DETECTORS", "*"));
            String config = Env.get("AUGUSTUS_CONFIG", "");
            if (!config.isBlank()) {
                cmd.add("--config");
                cmd.add(config);
            }
            String extra = Env.get("AUGUSTUS_ARGS", "");
            if (!extra.isBlank()) {
                for (String a : extra.trim().split("\\s+")) cmd.add(a);
            }
            System.out.println("[augustus] augustus scan " + generator + " --probes-glob " + probes);
            // --output always writes JSONL; --format jsonl also streams to stdout,
            // so discard stdout to avoid a full-pipe deadlock and read the file.
            Process run = new ProcessBuilder(cmd)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectErrorStream(false).start();
            String stderr = new String(run.getErrorStream().readAllBytes());
            int code = run.waitFor();

            File report = new File(output);
            if (!report.exists()) {
                String t = stderr.strip();
                throw new RuntimeException(t.isBlank() ? "augustus produced no report (exit " + code + ")"
                        : t.substring(Math.max(0, t.length() - 600)));
            }

            // A probe runs many attempts (varied payloads); collapse them to one
            // finding per probe+detector, keeping the worst-scoring attempt — so
            // one upload never carries duplicate identities.
            Map<String, Finding> byIdentity = new LinkedHashMap<>();
            Map<String, Double> worst = new HashMap<>();
            for (String line : Files.readAllLines(Path.of(output))) {
                String l = line.strip();
                if (l.isEmpty()) continue;
                JsonNode a = MAPPER.readTree(l);
                // Only vulnerable attempts are findings; passed==true is a safe pass.
                if (a.path("passed").asBoolean(true)) continue;
                if ("error".equals(a.path("status").asText(""))) continue;

                String probe = a.path("probe").asText("unknown");
                String detector = a.path("detector").asText("");
                double score = maxScore(a.path("scores"));
                String identity = "augustus:" + probe + ":" + detector;
                if (byIdentity.containsKey(identity) && score <= worst.get(identity)) {
                    continue; // keep the existing, worse-or-equal finding
                }
                worst.put(identity, score);

                Finding f = new Finding();
                f.identity = identity;
                f.ruleId = probe;
                f.name = probe + (detector.isBlank() ? "" : " (" + detector + ")");
                f.category = family(probe);
                f.severity = severityOf(score);
                f.description = describe(a, score);
                FindingLocation loc = new FindingLocation();
                loc.path = targetLabel(generator) + " · probe=" + probe;
                f.location = loc;
                byIdentity.put(identity, f);
            }

            client.uploadFindings(scanId, new ArrayList<>(byIdentity.values()));
            client.completeScan(scanId, null);
            return 0;
        } catch (Exception exc) {
            try {
                client.completeScan(scanId, exc.getMessage());
            } catch (Exception ignore) {
                // best effort
            }
            System.err.println("[augustus] failed: " + exc.getMessage());
            return 1;
        }
    }

    /** scores is a float array (0.0 safe .. 1.0 vulnerable); take the worst. */
    private static double maxScore(JsonNode scores) {
        double max = 1.0; // a passed:false attempt is vulnerable even if scores is absent
        if (scores.isArray() && !scores.isEmpty()) {
            max = 0;
            for (JsonNode s : scores) max = Math.max(max, s.asDouble(0));
        }
        return max;
    }

    /**
     * A confirmed LLM jailbreak/injection is a real exposure, so the floor is
     * High; the highest-confidence detections escalate to Critical.
     */
    private static String severityOf(double score) {
        if (score >= 0.9) return "Critical";
        if (score >= 0.5) return "High";
        return "Medium";
    }

    private static String family(String probe) {
        int dot = probe.indexOf('.');
        return dot > 0 ? probe.substring(0, dot) : probe;
    }

    private static String describe(JsonNode a, double score) {
        StringBuilder sb = new StringBuilder();
        sb.append("Augustus detected an LLM vulnerability (score ")
          .append(String.format("%.2f", score)).append(").");
        String prompt = a.path("prompt").asText("");
        String response = a.path("response").asText("");
        if (!prompt.isBlank()) sb.append("\n\nProbe prompt:\n").append(truncate(prompt, 1500));
        if (!response.isBlank()) sb.append("\n\nModel response:\n").append(truncate(response, 2000));
        String d = sb.toString();
        return d.length() > 4000 ? d.substring(0, 4000) : d;
    }

    private static String targetLabel(String generator) {
        return generator;
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }
}
