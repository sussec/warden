package com.techanv.warden.client.source;

import java.io.File;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** GitHub Actions context — posts findings as a pull-request review. */
final class GitHubSourceManager extends SourceManager {
    private final String token = env("GITHUB_TOKEN", "");
    private final String api = trim(env("GITHUB_API_URL", "https://api.github.com"));
    private final String server = trim(env("GITHUB_SERVER_URL", "https://github.com"));
    private final String repository = env("GITHUB_REPOSITORY", ""); // owner/repo
    private final String pr = detectPr();

    static boolean active() {
        return "true".equalsIgnoreCase(System.getenv("GITHUB_ACTIONS"));
    }

    @Override public String provider() { return "GitHub"; }
    @Override public String mergeRequestId() { return pr; }
    @Override public String targetBranch() { return emptyToNull(System.getenv("GITHUB_BASE_REF")); }
    @Override public String commitSha() { return emptyToNull(System.getenv("GITHUB_SHA")); }
    @Override public String blobUrl() { return server + "/" + repository + "/blob"; }

    private static String detectPr() {
        String ref = env("GITHUB_REF", "");
        if (ref.startsWith("refs/pull/")) {
            return ref.split("/")[2];
        }
        String path = System.getenv("GITHUB_EVENT_PATH");
        if (path != null && new File(path).exists()) {
            try {
                JsonNode payload = new ObjectMapper().readTree(new File(path));
                JsonNode number = payload.path("pull_request").path("number");
                if (number.isMissingNode() || number.isNull()) number = payload.path("number");
                return number.isIntegralNumber() ? number.asText() : null;
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    @Override
    protected boolean createReviewComment(String path, int startLine, int endLine, String title, String body) {
        if (token.isBlank() || pr == null || !repository.contains("/")) {
            return false;
        }
        String[] parts = repository.split("/", 2);
        Map<String, Object> comment = new LinkedHashMap<>();
        comment.put("path", path);
        comment.put("body", body);
        comment.put("side", "RIGHT");
        if (startLine > 0 && endLine > startLine) {
            comment.put("start_line", startLine);
            comment.put("line", endLine);
        } else {
            comment.put("line", startLine > 0 ? startLine : 1);
        }
        Map<String, Object> review = new LinkedHashMap<>();
        review.put("body", title);
        review.put("event", "COMMENT");
        review.put("comments", List.of(comment));
        String url = api + "/repos/" + parts[0] + "/" + parts[1] + "/pulls/" + pr + "/reviews";
        Http.Result res = Http.send("POST", url, "Authorization", "Bearer " + token, review);
        return res.status() >= 200 && res.status() < 300;
    }

    private static String env(String n, String d) {
        String v = System.getenv(n);
        return (v == null || v.isBlank()) ? d : v;
    }

    private static String trim(String s) { return s.replaceAll("/+$", ""); }

    private static String emptyToNull(String s) { return (s == null || s.isBlank()) ? null : s; }
}
