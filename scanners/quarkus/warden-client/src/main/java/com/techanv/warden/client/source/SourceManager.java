package com.techanv.warden.client.source;

import java.util.List;

import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;

/**
 * Source-control context for CI scans. Detects the merge-/pull-request context
 * from CI environment variables and posts new findings as inline review
 * comments on the changed lines (shift-left feedback). All network calls are
 * best-effort: a failure here never fails the scan.
 *
 * Ported from the upstream Go analyzer (califio/code-secure-analyzer).
 */
public abstract class SourceManager {

    public String provider() { return "local"; }

    public boolean isMergeRequest() { return mergeRequestId() != null && !mergeRequestId().isBlank(); }

    public String mergeRequestId() { return null; }

    public String targetBranch() { return null; }

    public String commitSha() { return null; }

    public String blobUrl() { return ""; }

    /** Post one inline review comment. Returns true on success. */
    protected boolean createReviewComment(String path, int startLine, int endLine, String title, String body) {
        return false;
    }

    /** Detect the active CI provider. */
    public static SourceManager detect() {
        if (GitHubSourceManager.active()) return new GitHubSourceManager();
        if (GitLabSourceManager.active()) return new GitLabSourceManager();
        return new SourceManager() {};
    }

    /** Post each new finding as an inline comment. Returns the count posted. */
    public int postNewFindings(List<Finding> newFindings, String findingUrl) {
        if (!isMergeRequest() || newFindings == null || newFindings.isEmpty()) {
            return 0;
        }
        String blob = blobUrl();
        String sha = commitSha() == null ? "" : commitSha();
        int posted = 0;
        for (Finding finding : newFindings) {
            FindingLocation loc = finding.location;
            if (loc == null || loc.path == null || loc.path.isBlank()) {
                continue;
            }
            String body = message(finding, blob, sha, findingUrl);
            boolean ok = createReviewComment(
                    loc.path,
                    loc.startLine == null ? 0 : loc.startLine,
                    loc.endLine == null ? 0 : loc.endLine,
                    finding.name == null ? "Finding" : finding.name,
                    body);
            if (ok) posted++;
        }
        if (posted > 0) {
            System.err.printf("[warden] posted %d finding comment(s) on %s merge request%n", posted, provider());
        }
        return posted;
    }

    /** Render the markdown body posted for a new finding (mirrors upstream). */
    static String message(Finding f, String blobUrl, String commitSha, String findingUrl) {
        FindingLocation loc = f.location;
        String path = loc != null ? loc.path : null;
        String snippet = loc != null ? loc.snippet : null;
        int start = loc != null && loc.startLine != null ? loc.startLine : 0;
        String detail = (f.id != null && !f.id.isBlank())
                ? trimSlash(findingUrl) + "/#/finding/" + f.id
                : findingUrl;
        String name = f.name == null ? "Finding" : f.name;
        StringBuilder msg = new StringBuilder("**[").append(name).append("](").append(detail).append(")**\n\n");
        if (path != null && !path.isBlank()) {
            if (commitSha != null && !commitSha.isBlank()) {
                String locUrl = blobUrl + "/" + commitSha + "/" + path + "#L" + start;
                String snip = (snippet != null && !snippet.isBlank()) ? "`" + snippet + "` @ " : "";
                msg.append("**Location:** ").append(snip).append("[").append(path).append("](").append(locUrl).append(")\n\n");
            } else {
                msg.append("**Location:** `").append(path).append("`\n\n");
            }
        }
        if (f.description != null && !f.description.isBlank()) {
            msg.append("**Description**\n\n").append(f.description).append("\n\n");
        }
        if (f.recommendation != null && !f.recommendation.isBlank()) {
            msg.append("**Recommendation**\n\n").append(f.recommendation).append("\n");
        }
        return msg.toString().strip();
    }

    private static String trimSlash(String s) {
        return s == null ? "" : s.replaceAll("/+$", "");
    }
}
