using Warden.Core.Enum;

namespace Warden.Application.Helpers;

public static class GitRepoHelpers
{
    public static string UrlByCommit(SourceType sourceType, string repoUrl, string commitSha, string path, int? startLine = null, int? endLine = null)
    {
        var baseUrl = repoUrl.TrimEnd('/');
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
        var baseUrl = repoUrl.TrimEnd('/');
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
        var baseUrl = repoUrl.TrimEnd('/');
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
