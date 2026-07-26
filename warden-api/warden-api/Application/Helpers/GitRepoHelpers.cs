using Warden.Core.Enum;

namespace Warden.Application.Helpers;

public static class GitRepoHelpers
{
    /// <summary>Strip credentials and trailing .git for browse URLs.</summary>
    public static string NormalizeBrowseUrl(string? repoUrl)
    {
        if (string.IsNullOrWhiteSpace(repoUrl)) return string.Empty;
        var clean = repoUrl.Trim();
        // https://user:token@host/path → https://host/path
        if (clean.Contains("://") && clean.Contains('@'))
        {
            var schemeEnd = clean.IndexOf("://", StringComparison.Ordinal);
            var at = clean.IndexOf('@');
            if (at > schemeEnd)
                clean = clean[..(schemeEnd + 3)] + clean[(at + 1)..];
        }
        clean = clean.TrimEnd('/');
        if (clean.EndsWith(".git", StringComparison.OrdinalIgnoreCase))
            clean = clean[..^4];
        return clean;
    }

    /// <summary>
    /// Parse owner/repo from a GitHub clone or browse URL.
    /// https://github.com/org/repo(.git) → (org, repo)
    /// </summary>
    public static bool TryParseGitHubOwnerRepo(string? repoUrl, out string owner, out string repo)
    {
        owner = string.Empty;
        repo = string.Empty;
        if (string.IsNullOrWhiteSpace(repoUrl)) return false;
        try
        {
            var clean = NormalizeBrowseUrl(repoUrl);
            if (clean.StartsWith("git@", StringComparison.OrdinalIgnoreCase))
            {
                // git@github.com:owner/repo
                var colon = clean.IndexOf(':');
                if (colon < 0) return false;
                var path = clean[(colon + 1)..].Trim('/');
                var parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length < 2) return false;
                owner = parts[0];
                repo = parts[1];
                return true;
            }

            if (!Uri.TryCreate(clean, UriKind.Absolute, out var uri)) return false;
            var segs = uri.AbsolutePath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segs.Length < 2) return false;
            owner = segs[0];
            repo = segs[1];
            return !string.IsNullOrEmpty(owner) && !string.IsNullOrEmpty(repo);
        }
        catch
        {
            return false;
        }
    }

    public static string UrlByCommit(SourceType sourceType, string repoUrl, string commitSha, string path, int? startLine = null, int? endLine = null)
    {
        var baseUrl = NormalizeBrowseUrl(repoUrl);
        return sourceType switch
        {
            SourceType.GitLab => GitLabBlob(baseUrl, commitSha, path, startLine, endLine),
            SourceType.GitHub => GitHubBlob(baseUrl, commitSha, path, startLine, endLine),
            SourceType.Bitbucket => BitbucketBlob(baseUrl, commitSha, path, startLine, endLine),
            _ => $"{baseUrl}/{commitSha}/{path}",
        };
    }

    public static string BuildCommitUrl(SourceType sourceType, string repoUrl, string commitSha)
    {
        var baseUrl = NormalizeBrowseUrl(repoUrl);
        return sourceType switch
        {
            SourceType.GitLab => $"{baseUrl}/-/commit/{commitSha}",
            SourceType.GitHub => $"{baseUrl}/commit/{commitSha}",
            SourceType.Bitbucket => $"{baseUrl}/commits/{commitSha}",
            _ => baseUrl,
        };
    }

    public static string BuildMergeRequestUrl(SourceType sourceType, string repoUrl, string mergeRequestId)
    {
        if (string.IsNullOrWhiteSpace(mergeRequestId)) return string.Empty;
        var baseUrl = NormalizeBrowseUrl(repoUrl);
        return sourceType switch
        {
            SourceType.GitLab => $"{baseUrl}/-/merge_requests/{mergeRequestId}",
            SourceType.GitHub => $"{baseUrl}/pull/{mergeRequestId}",
            SourceType.Bitbucket => $"{baseUrl}/pull-requests/{mergeRequestId}",
            _ => string.Empty,
        };
    }

    private static string GitLabBlob(string baseUrl, string commitSha, string path, int? startLine, int? endLine)
    {
        var url = $"{baseUrl}/-/blob/{commitSha}/{path}";
        if (startLine is > 0)
        {
            url += $"#L{startLine}";
            if (endLine is > 0) url += $"-{endLine}";
        }
        return url;
    }

    private static string GitHubBlob(string baseUrl, string commitSha, string path, int? startLine, int? endLine)
    {
        var url = $"{baseUrl}/blob/{commitSha}/{path}";
        if (startLine is > 0)
        {
            url += $"#L{startLine}";
            if (endLine is > 0 && endLine != startLine) url += $"-L{endLine}";
        }
        return url;
    }

    private static string BitbucketBlob(string baseUrl, string commitSha, string path, int? startLine, int? endLine)
    {
        var url = $"{baseUrl}/src/{commitSha}/{path}";
        if (startLine is > 0)
        {
            url += endLine is > 0 && endLine != startLine
                ? $"#lines-{startLine}:{endLine}"
                : $"#lines-{startLine}";
        }
        return url;
    }
}
