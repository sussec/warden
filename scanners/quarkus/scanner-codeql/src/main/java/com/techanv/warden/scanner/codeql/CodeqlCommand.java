package com.techanv.warden.scanner.codeql;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.stream.Stream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.Env;
import com.techanv.warden.client.WardenClient;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;

import picocli.CommandLine;

/**
 * GitHub CodeQL SAST analyzer for Techanv Warden (Quarkus port).
 *
 * CodeQL is a semantic code-analysis engine: it builds a queryable database
 * from source and runs security query suites against it. This wrapper detects
 * which supported languages are present in {@code /src}, builds a database
 * cluster with {@code --build-mode=none} (no project build required), runs each
 * language's default {@code code-scanning} suite to SARIF, and maps every SARIF
 * result to a Warden SAST finding — mirroring the server's SarifMapper so
 * severity/identity are consistent whether CodeQL is ingested here or via the
 * /api/ci/sarif endpoint.
 *
 * Optional environment:
 *   CODEQL_LANGUAGES   comma-separated CodeQL language ids to force
 *                      (default: auto-detect from files in PROJECT_PATH)
 *   CODEQL_THREADS     analysis threads (default 0 = one per core)
 *   CODEQL_RAM         analysis RAM budget in MB (passed to --ram)
 */
@CommandLine.Command(name = "codeql", mixinStandardHelpOptions = true,
        description = "Run GitHub CodeQL (SAST) and report findings to Techanv Warden.")
public class CodeqlCommand implements Callable<Integer> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    // CodeQL language id -> file extensions that imply its presence. Only
    // CodeQL language id -> file extensions implying its presence.
    private static final Map<String, String[]> LANGUAGES = new LinkedHashMap<>();
    static {
        LANGUAGES.put("javascript-typescript", new String[]{".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue"});
        LANGUAGES.put("python", new String[]{".py"});
        LANGUAGES.put("ruby", new String[]{".rb"});
        LANGUAGES.put("java", new String[]{".java"});
        LANGUAGES.put("csharp", new String[]{".cs"});
    }

    // Compiled languages need an explicit --build-mode=none to skip the build.
    // Interpreted languages (js/ts, python, ruby) reject the flag — they build
    // without compilation by default.
    private static final Set<String> NEEDS_BUILD_MODE_NONE = Set.of("java", "csharp");

    @Override
    public Integer call() {
        String project = Env.get("PROJECT_PATH", "/src");
        String dbRoot = "/tmp/codeql-db";
        String sarifDir = "/tmp/codeql-sarif";
        WardenClient client = new WardenClient();
        String scanId;
        try {
            scanId = client.createScan("codeql", "Sast", project);
        } catch (Exception e) {
            System.err.println("[codeql] could not create scan: " + e.getMessage());
            return 1;
        }
        try {
            // CodeQL requires the database's parent directory to already exist.
            Files.createDirectories(Path.of(dbRoot));
            Files.createDirectories(Path.of(sarifDir));
            List<String> languages = resolveLanguages(project);
            if (languages.isEmpty()) {
                System.out.println("[codeql] no supported languages detected in " + project + "; nothing to scan");
                client.uploadFindings(scanId, List.of());
                client.completeScan(scanId, null);
                return 0;
            }
            System.out.println("[codeql] languages: " + String.join(",", languages));

            // Build + analyze each language independently so one language's
            // failure does not abort the others, and so interpreted vs compiled
            // languages can use the right build mode (a --db-cluster would force
            // a single build mode across all of them).
            List<Finding> findings = new ArrayList<>();
            Set<String> seen = new LinkedHashSet<>();
            List<String> failures = new ArrayList<>();
            int analyzed = 0;
            for (String lang : languages) {
                try {
                    Path db = Path.of(dbRoot, lang);
                    List<String> create = new ArrayList<>(List.of(
                            "codeql", "database", "create", db.toString(),
                            "--language=" + lang,
                            "--source-root=" + project,
                            "--overwrite"));
                    if (NEEDS_BUILD_MODE_NONE.contains(lang)) {
                        create.add("--build-mode=none");
                    }
                    runOrThrow(create, "database create (" + lang + ")");

                    String sarif = sarifDir + "/" + lang + ".sarif";
                    List<String> analyze = new ArrayList<>(List.of(
                            "codeql", "database", "analyze", db.toString(),
                            // Run the language's standard code-scanning security
                            // suite explicitly; a bare analyze does not reliably
                            // run the security queries.
                            suiteFor(lang),
                            "--format=sarif-latest", "--output=" + sarif,
                            "--sarif-category=" + lang,
                            "--threads=" + Env.get("CODEQL_THREADS", "0")));
                    String ram = Env.get("CODEQL_RAM", "");
                    if (!ram.isBlank()) analyze.add("--ram=" + ram);
                    runOrThrow(analyze, "analyze (" + lang + ")");

                    parseSarif(Path.of(sarif), project, findings, seen);
                    analyzed++;
                } catch (Exception langErr) {
                    System.err.println("[codeql] " + lang + " skipped: " + langErr.getMessage());
                    failures.add(lang);
                }
            }

            if (analyzed == 0 && !failures.isEmpty()) {
                throw new RuntimeException("all languages failed: " + String.join(", ", failures));
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
            System.err.println("[codeql] failed: " + exc.getMessage());
            return 1;
        }
    }

    /** Detect languages from file extensions unless explicitly forced via env. */
    private static List<String> resolveLanguages(String project) throws Exception {
        String forced = Env.get("CODEQL_LANGUAGES", "");
        if (!forced.isBlank()) {
            List<String> out = new ArrayList<>();
            for (String l : forced.split(",")) {
                String s = l.strip();
                if (!s.isEmpty()) out.add(s);
            }
            return out;
        }
        Set<String> exts = new LinkedHashSet<>();
        Path root = Path.of(project);
        if (Files.isDirectory(root)) {
            try (Stream<Path> walk = Files.walk(root, 12)) {
                walk.filter(Files::isRegularFile).forEach(p -> {
                    String n = p.getFileName().toString();
                    int dot = n.lastIndexOf('.');
                    if (dot >= 0) exts.add(n.substring(dot).toLowerCase());
                });
            }
        }
        List<String> langs = new ArrayList<>();
        for (var entry : LANGUAGES.entrySet()) {
            for (String ext : entry.getValue()) {
                if (exts.contains(ext)) {
                    langs.add(entry.getKey());
                    break;
                }
            }
        }
        return langs;
    }

    /** The standard code-scanning suite name CodeQL ships for a language. */
    private static String suiteFor(String lang) {
        // The js/ts database language id is javascript-typescript, but its query
        // suite is named javascript-code-scanning.
        String pack = lang.equals("javascript-typescript") ? "javascript" : lang;
        return pack + "-code-scanning.qls";
    }

    private static void runOrThrow(List<String> cmd, String stage) throws Exception {
        System.out.println("[codeql] " + String.join(" ", cmd));
        // Discard stdout (verbose progress) to avoid a full-pipe deadlock; keep
        // stderr for diagnostics.
        Process run = new ProcessBuilder(cmd)
                .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                .redirectErrorStream(false).start();
        String stderr = new String(run.getErrorStream().readAllBytes());
        int code = run.waitFor();
        if (code != 0) {
            String t = stderr.strip();
            throw new RuntimeException("codeql " + stage + " failed (exit " + code + "): "
                    + (t.isBlank() ? "" : t.substring(Math.max(0, t.length() - 800))));
        }
    }

    /** Map SARIF 2.1.0 results to findings, mirroring the server SarifMapper. */
    private static void parseSarif(Path sarif, String project, List<Finding> findings, Set<String> seen)
            throws Exception {
        if (!Files.exists(sarif) || Files.size(sarif) == 0) return;
        JsonNode root = MAPPER.readTree(Files.readAllBytes(sarif));
        for (JsonNode run : root.path("runs")) {
            // Index rule metadata (security-severity, tags) by rule id.
            Map<String, JsonNode> rules = new LinkedHashMap<>();
            for (JsonNode rule : run.path("tool").path("driver").path("rules")) {
                rules.put(rule.path("id").asText(""), rule);
            }
            for (JsonNode result : run.path("results")) {
                String ruleId = firstNonBlank(result.path("ruleId").asText(""),
                        result.path("rule").path("id").asText(""), "unknown");
                JsonNode rule = rules.getOrDefault(ruleId, MAPPER.missingNode());

                JsonNode region = result.path("locations").path(0)
                        .path("physicalLocation").path("region");
                String uri = result.path("locations").path(0)
                        .path("physicalLocation").path("artifactLocation").path("uri").asText("");
                String path = normalizePath(uri);
                int startLine = region.path("startLine").asInt(0);

                String identity = ruleId + ":" + path + ":" + startLine;
                if (!seen.add(identity)) continue; // de-dupe within this upload

                Finding f = new Finding();
                f.identity = identity;
                f.ruleId = ruleId;
                f.name = firstNonBlank(rule.path("name").asText(""),
                        rule.path("shortDescription").path("text").asText(""), ruleId);
                f.description = firstNonBlank(result.path("message").path("text").asText(""),
                        rule.path("fullDescription").path("text").asText(""),
                        rule.path("shortDescription").path("text").asText(""), ruleId);
                f.category = categoryOf(rule);
                f.severity = severityOf(result, rule);

                FindingLocation loc = new FindingLocation();
                loc.path = path;
                loc.startLine = startLine > 0 ? startLine : null;
                int endLine = region.path("endLine").asInt(0);
                loc.endLine = endLine > 0 ? endLine : null;
                int startCol = region.path("startColumn").asInt(0);
                loc.startColumn = startCol > 0 ? startCol : null;
                int endCol = region.path("endColumn").asInt(0);
                loc.endColumn = endCol > 0 ? endCol : null;
                f.location = loc;
                findings.add(f);
            }
        }
    }

    /**
     * CodeQL puts a CVSS-like 0–10 "security-severity" in rule.properties; map
     * it to Warden buckets, falling back to the SARIF level. Mirrors the
     * server-side SarifMapper so ingestion is consistent.
     */
    private static String severityOf(JsonNode result, JsonNode rule) {
        String sec = rule.path("properties").path("security-severity").asText("");
        if (!sec.isBlank()) {
            try {
                double s = Double.parseDouble(sec);
                if (s >= 9.0) return "Critical";
                if (s >= 7.0) return "High";
                if (s >= 4.0) return "Medium";
                if (s > 0) return "Low";
            } catch (NumberFormatException ignore) {
                // fall through to level
            }
        }
        String level = firstNonBlank(result.path("level").asText(""),
                rule.path("defaultConfiguration").path("level").asText(""), "warning");
        switch (level) {
            case "error": return "High";
            case "warning": return "Medium";
            case "note": return "Low";
            default: return "Info";
        }
    }

    private static String categoryOf(JsonNode rule) {
        JsonNode tags = rule.path("properties").path("tags");
        if (tags.isArray()) {
            for (JsonNode t : tags) {
                String tag = t.asText("");
                if (tag.startsWith("external/cwe/")) {
                    return tag.substring(tag.lastIndexOf('/') + 1).toUpperCase().replace("CWE-", "CWE-");
                }
            }
            if (!tags.isEmpty()) return tags.get(0).asText(null);
        }
        return null;
    }

    /** SARIF URIs are repo-relative; strip any file:// scheme and leading slash. */
    private static String normalizePath(String uri) {
        String p = uri;
        if (p.startsWith("file://")) p = p.substring("file://".length());
        while (p.startsWith("/")) p = p.substring(1);
        return p;
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }
}
