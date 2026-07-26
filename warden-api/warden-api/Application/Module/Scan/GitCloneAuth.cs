using Warden.Application.Module.Integration.GitHub;
using Warden.Application.Module.Integration.GitLab;
using Warden.Core.Utils;

namespace Warden.Application.Module.Scan;

/// <summary>
/// Builds authenticated HTTPS clone URLs at job runtime only.
/// Never persist the result on ScanJobs / Projects.
/// </summary>
public static class GitCloneAuth
{
    public static async Task<string> ResolveCloneUrlAsync(
        AppDbContext context,
        string target,
        CancellationToken cancellationToken = default)
    {
        var clean = SecretRedactor.StripUrlCredentials(target);
        if (!clean.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return clean;

        // Prefer explicit runner token (ops-configured for private clones).
        if (!string.IsNullOrWhiteSpace(Configuration.ScanGitToken))
        {
            var rest = clean["https://".Length..];
            return $"https://x-access-token:{Configuration.ScanGitToken}@{rest}";
        }

        try
        {
            var host = new Uri(clean).Host;

            // GitHub.com + GitHub Enterprise (api often on same host /api/v3)
            var gh = await context.GetGitHubSettingAsync();
            if (!string.IsNullOrWhiteSpace(gh.Token) && IsGitHubHost(host, gh.ApiUrl))
            {
                var rest = clean["https://".Length..];
                return $"https://x-access-token:{gh.Token}@{rest}";
            }

            var gl = await context.GetGitLabSettingAsync();
            if (!string.IsNullOrWhiteSpace(gl.Token) && IsGitLabHost(host, gl.ApiUrl))
            {
                var rest = clean["https://".Length..];
                return $"https://oauth2:{gl.Token}@{rest}";
            }
        }
        catch
        {
            /* fall through — public clone */
        }

        return clean;
    }

    private static bool IsGitHubHost(string host, string? apiUrl)
    {
        if (host.Equals("github.com", StringComparison.OrdinalIgnoreCase) ||
            host.Equals("www.github.com", StringComparison.OrdinalIgnoreCase))
            return true;
        if (string.IsNullOrWhiteSpace(apiUrl)) return false;
        try
        {
            var apiHost = new Uri(apiUrl).Host;
            // api.github.com → github.com; GHE often api.<host> or <host>/api/v3
            if (apiHost.Equals(host, StringComparison.OrdinalIgnoreCase)) return true;
            if (apiHost.StartsWith("api.", StringComparison.OrdinalIgnoreCase) &&
                apiHost["api.".Length..].Equals(host, StringComparison.OrdinalIgnoreCase))
                return true;
            // Enterprise: api.github.mycorp.com vs github.mycorp.com
            if (host.Contains("github", StringComparison.OrdinalIgnoreCase) &&
                apiHost.Contains("github", StringComparison.OrdinalIgnoreCase))
                return true;
        }
        catch { /* ignore */ }
        return false;
    }

    private static bool IsGitLabHost(string host, string? apiUrl)
    {
        if (host.Equals("gitlab.com", StringComparison.OrdinalIgnoreCase) ||
            host.Equals("www.gitlab.com", StringComparison.OrdinalIgnoreCase))
            return true;
        if (string.IsNullOrWhiteSpace(apiUrl)) return false;
        try
        {
            // Self-managed: API URL is usually https://gitlab.example.com/api/v4
            var apiHost = new Uri(apiUrl).Host;
            return apiHost.Equals(host, StringComparison.OrdinalIgnoreCase);
        }
        catch { /* ignore */ }
        return false;
    }
}
