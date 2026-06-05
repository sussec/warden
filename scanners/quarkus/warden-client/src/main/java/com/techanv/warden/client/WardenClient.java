package com.techanv.warden.client;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.techanv.warden.client.model.CiScanInfo;
import com.techanv.warden.client.model.CiScanRequest;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.UploadFindingResponse;
import com.techanv.warden.client.source.SourceManager;

/**
 * Client for the Warden CI ingest contract:
 *   POST /api/ci/scan        (CI-TOKEN header) -> { scanId, scanUrl, lastCommitSha }
 *   POST /api/ci/finding     { scanId, findings[], strategy } -> { newFindings, ... }
 *   PUT  /api/ci/scan/{id}   { status, description }
 *
 * In a merge-request pipeline it also posts new findings as inline review
 * comments (shift-left feedback) via the detected {@link SourceManager}.
 */
public class WardenClient {
    private final String base;
    private final String token;
    private final HttpClient http;
    private final ObjectMapper mapper = new ObjectMapper();
    private final SourceManager source;

    public WardenClient() {
        this.base = Env.get("WARDEN_URL", "http://warden:8080").replaceAll("/+$", "");
        this.token = Env.require("WARDEN_TOKEN");
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
        this.source = SourceManager.detect();
    }

    private <T> T request(String method, String path, Object body, Class<T> type) throws Exception {
        byte[] payload = body == null ? new byte[0] : mapper.writeValueAsBytes(body);
        HttpRequest req = HttpRequest.newBuilder(URI.create(base + path))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/json")
                .header("CI-TOKEN", token)
                .method(method, HttpRequest.BodyPublishers.ofByteArray(payload))
                .build();
        HttpResponse<byte[]> res = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
        if (res.statusCode() >= 300) {
            throw new RuntimeException("warden " + path + " -> HTTP " + res.statusCode());
        }
        if (type == null || res.body() == null || res.body().length == 0) {
            return null;
        }
        return mapper.readValue(res.body(), type);
    }

    public String createScan(String scanner, String scannerType, String projectPath) throws Exception {
        return createScan(scanner, scannerType, projectPath, null);
    }

    /** {@code repoNameOverride} sets the repo identity for targets without a checkout (DAST URL, image ref). */
    public String createScan(String scanner, String scannerType, String projectPath, String repoNameOverride) throws Exception {
        String repoName = Env.get("REPO_NAME",
                repoNameOverride != null ? repoNameOverride
                        : new java.io.File(projectPath).getAbsoluteFile().getName());
        String branch = firstNonNull(System.getenv("BRANCH"),
                Env.git(projectPath, "rev-parse", "--abbrev-ref", "HEAD"), "main");
        String commit = firstNonNull(System.getenv("COMMIT"),
                Env.git(projectPath, "rev-parse", "HEAD"), "local");
        String title = firstNonNull(System.getenv("SCAN_TITLE"),
                Env.git(projectPath, "log", "-1", "--pretty=%s"), "Local " + scanner + " scan");

        CiScanRequest body = new CiScanRequest();
        body.repoId = Env.get("REPO_ID", repoName);
        body.repoUrl = Env.get("REPO_URL", "https://local/" + repoName);
        body.repoName = repoName;
        body.scanTitle = title;
        body.commitBranch = branch;
        body.commitHash = commit;
        body.scanner = scanner;
        body.type = scannerType;
        body.isDefault = !"false".equalsIgnoreCase(Env.get("IS_DEFAULT", "true"));

        if (source.isMergeRequest()) {
            body.gitAction = "MergeRequest";
            body.mergeRequestId = source.mergeRequestId();
            body.targetBranch = source.targetBranch();
            body.isDefault = false;
        }

        CiScanInfo info = request("POST", "/api/ci/scan", body, CiScanInfo.class);
        System.out.printf("[warden] scan %s created for %s@%s (%s)%n",
                info.scanId(), repoName, branch, commit.length() > 12 ? commit.substring(0, 12) : commit);
        return info.scanId();
    }

    public UploadFindingResponse uploadFindings(String scanId, List<Finding> findings) throws Exception {
        var body = new java.util.HashMap<String, Object>();
        body.put("scanId", scanId);
        body.put("findings", findings);
        body.put("strategy", "AllFiles");
        UploadFindingResponse response = request("POST", "/api/ci/finding", body, UploadFindingResponse.class);
        System.out.printf("[warden] uploaded %d finding(s)%n", findings.size());
        if (response != null) {
            int newCount = response.newFindings() == null ? 0 : response.newFindings().size();
            int fixedCount = response.fixedFindings() == null ? 0 : response.fixedFindings().size();
            if (newCount > 0) System.out.printf("[warden] %d new finding(s) introduced%n", newCount);
            if (fixedCount > 0) System.out.printf("[warden] %d finding(s) fixed%n", fixedCount);
            try {
                source.postNewFindings(
                        response.newFindings(),
                        response.findingUrl() != null ? response.findingUrl() : base);
            } catch (Exception e) {
                System.err.println("[warden] merge-request comment skipped: " + e.getMessage());
            }
        }
        return response;
    }

    public void uploadDependencies(String scanId, java.util.Collection<com.techanv.warden.client.model.PackageInfo> packages,
            java.util.Collection<com.techanv.warden.client.model.VulnerabilityInfo> vulnerabilities) throws Exception {
        var body = new java.util.HashMap<String, Object>();
        body.put("scanId", scanId);
        body.put("packages", packages);
        body.put("vulnerabilities", vulnerabilities);
        request("POST", "/api/ci/dependency", body, null);
        System.out.printf("[warden] uploaded %d package(s), %d vulnerability(ies)%n",
                packages.size(), vulnerabilities.size());
    }

    public void completeScan(String scanId, String error) throws Exception {
        var body = new java.util.HashMap<String, Object>();
        if (error != null) {
            body.put("status", "Error");
            body.put("description", error);
        } else {
            body.put("status", "Completed");
        }
        request("PUT", "/api/ci/scan/" + scanId, body, null);
        System.out.printf("[warden] scan %s %s%n", scanId, error != null ? "failed: " + error : "completed");
    }

    private static String firstNonNull(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }
}
