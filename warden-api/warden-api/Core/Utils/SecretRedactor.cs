using System.Text.RegularExpressions;

namespace Warden.Core.Utils;

/// <summary>
/// Strips credentials from URLs and free text before they reach the UI / logs.
/// Tokens must never be shown in Scan Runs, stream events, or error messages.
/// </summary>
public static partial class SecretRedactor
{
    // https://user:secret@host  or  https://oauth2:token@host
    [GeneratedRegex(
        @"(?i)(https?://)([^/\s:@]+):([^/\s@]+)@",
        RegexOptions.Compiled)]
    private static partial Regex UrlUserInfoRegex();

    // Standalone GitHub / GitLab style tokens
    [GeneratedRegex(
        @"(?i)\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{10,}\b",
        RegexOptions.Compiled)]
    private static partial Regex GitHubTokenRegex();

    [GeneratedRegex(
        @"(?i)\bglpat-[A-Za-z0-9\-_]{10,}\b",
        RegexOptions.Compiled)]
    private static partial Regex GitLabTokenRegex();

    [GeneratedRegex(
        @"(?i)\b(xox[baprs]-|sk-|AKIA)[A-Za-z0-9\-_]{8,}\b",
        RegexOptions.Compiled)]
    private static partial Regex GenericSecretRegex();

    public static string Redact(string? text)
    {
        if (string.IsNullOrEmpty(text)) return text ?? string.Empty;

        var s = UrlUserInfoRegex().Replace(text, "$1$2:***@");
        s = GitHubTokenRegex().Replace(s, "$1_***");
        s = GitLabTokenRegex().Replace(s, "glpat-***");
        s = GenericSecretRegex().Replace(s, "***");
        return s;
    }

    /// <summary>
    /// Returns a URL with userinfo removed (clean https://host/path.git).
    /// Safe to store on projects and scan jobs.
    /// </summary>
    public static string StripUrlCredentials(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return url ?? string.Empty;
        try
        {
            var uri = new Uri(url.Trim());
            if (string.IsNullOrEmpty(uri.UserInfo)) return url.Trim();
            var builder = new UriBuilder(uri) { UserName = "", Password = "" };
            // UriBuilder leaves userinfo empty; AbsoluteUri is clean.
            return builder.Uri.AbsoluteUri;
        }
        catch
        {
            return UrlUserInfoRegex().Replace(url, "$1");
        }
    }
}
