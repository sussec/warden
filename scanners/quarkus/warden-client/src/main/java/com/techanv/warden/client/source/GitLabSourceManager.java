package com.techanv.warden.client.source;

import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

/** GitLab CI context — posts findings as MR discussions anchored to the diff. */
final class GitLabSourceManager extends SourceManager {
    private final String token = firstNonBlank(System.getenv("GITLAB_TOKEN"), System.getenv("CI_JOB_TOKEN"), "");
    private final String api = trim(env("CI_API_V4_URL", "https://gitlab.com/api/v4"));
    private final String projectId = env("CI_PROJECT_ID", "");
    private final String projectUrl = env("CI_PROJECT_URL", "");
    private final String iid = emptyToNull(System.getenv("CI_MERGE_REQUEST_IID"));
    private JsonNode diffRefs;

    static boolean active() {
        return "true".equalsIgnoreCase(System.getenv("GITLAB_CI"));
    }

    @Override public String provider() { return "GitLab"; }
    @Override public String mergeRequestId() { return iid; }
    @Override public String targetBranch() { return emptyToNull(System.getenv("CI_MERGE_REQUEST_TARGET_BRANCH_NAME")); }
    @Override public String commitSha() { return emptyToNull(System.getenv("CI_COMMIT_SHA")); }
    @Override public String blobUrl() { return projectUrl + "/-/blob"; }

    private JsonNode refs() {
        if (diffRefs == null && !token.isBlank() && iid != null) {
            String url = api + "/projects/" + projectId + "/merge_requests/" + iid;
            Http.Result res = Http.send("GET", url, "PRIVATE-TOKEN", token, null);
            diffRefs = res.body() != null ? res.body().path("diff_refs") : null;
        }
        return diffRefs;
    }

    @Override
    protected boolean createReviewComment(String path, int startLine, int endLine, String title, String body) {
        if (token.isBlank() || iid == null) {
            return false;
        }
        JsonNode refs = refs();
        Map<String, Object> position = new LinkedHashMap<>();
        position.put("position_type", "text");
        if (refs != null) {
            position.put("base_sha", refs.path("base_sha").asText(null));
            position.put("start_sha", refs.path("start_sha").asText(null));
            position.put("head_sha", refs.path("head_sha").asText(null));
        }
        position.put("new_path", path);
        position.put("old_path", path);
        position.put("new_line", startLine > 0 ? startLine : 1);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("body", body);
        payload.put("position", position);
        String url = api + "/projects/" + projectId + "/merge_requests/" + iid + "/discussions";
        Http.Result res = Http.send("POST", url, "PRIVATE-TOKEN", token, payload);
        if (res.status() == 400) {
            // line not on the diff — fall back to a plain MR note
            String noteUrl = api + "/projects/" + projectId + "/merge_requests/" + iid + "/notes";
            Http.Result note = Http.send("POST", noteUrl, "PRIVATE-TOKEN", token,
                    Map.of("body", "**" + title + "**\n\n" + body));
            return note.status() >= 200 && note.status() < 300;
        }
        return res.status() >= 200 && res.status() < 300;
    }

    private static String env(String n, String d) {
        String v = System.getenv(n);
        return (v == null || v.isBlank()) ? d : v;
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) if (s != null && !s.isBlank()) return s;
        return "";
    }

    private static String trim(String s) { return s.replaceAll("/+$", ""); }

    private static String emptyToNull(String s) { return (s == null || s.isBlank()) ? null : s; }
}
