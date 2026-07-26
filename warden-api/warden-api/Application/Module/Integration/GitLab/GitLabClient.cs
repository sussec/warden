using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentResults;

namespace Warden.Application.Module.Integration.GitLab;

public record GitLabProject
{
    public long Id { get; set; }
    public string PathWithNamespace { get; set; } = string.Empty;
    public string HttpUrlToRepo { get; set; } = string.Empty;
    public string WebUrl { get; set; } = string.Empty;
    public string DefaultBranch { get; set; } = "main";
    public string Visibility { get; set; } = "private";
}

public record GitLabIssueRequest
{
    [JsonPropertyName("title")] public required string Title { get; set; }
    [JsonPropertyName("description")] public required string Description { get; set; }
    [JsonPropertyName("labels")] public string? Labels { get; set; }
}

public record GitLabIssueResponse
{
    [JsonPropertyName("iid")] public long Iid { get; set; }
    [JsonPropertyName("id")] public long Id { get; set; }
    [JsonPropertyName("web_url")] public string WebUrl { get; set; } = string.Empty;
}

public class GitLabClient
{
    private readonly HttpClient httpClient;

    public GitLabClient(string apiUrl, string token)
    {
        if (string.IsNullOrWhiteSpace(apiUrl))
            apiUrl = "https://gitlab.com/api/v4";
        // Accept either https://gitlab.com or https://gitlab.com/api/v4
        apiUrl = apiUrl.Trim().TrimEnd('/');
        if (!apiUrl.EndsWith("/api/v4", StringComparison.OrdinalIgnoreCase))
            apiUrl += "/api/v4";

        httpClient = new HttpClient
        {
            BaseAddress = new Uri(apiUrl.TrimEnd('/') + "/"),
            Timeout = TimeSpan.FromSeconds(60)
        };
        httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));
        httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Warden");
        token = token?.Trim() ?? string.Empty;
        if (!string.IsNullOrEmpty(token))
            httpClient.DefaultRequestHeaders.Add("PRIVATE-TOKEN", token);
    }

    public async Task<Result<bool>> TestConnectionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await httpClient.GetAsync("user", cancellationToken);
            return response.IsSuccessStatusCode
                ? Result.Ok(true)
                : Result.Fail($"GitLab responded with status {(int)response.StatusCode}");
        }
        catch (Exception e)
        {
            return Result.Fail(e.Message);
        }
    }

    public async Task<Result<List<GitLabProject>>> ListProjectsAsync(
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = new List<GitLabProject>();
            var page = 1;
            while (true)
            {
                // membership=true: all projects the token can access (user + groups).
                var response = await httpClient.GetAsync(
                    $"projects?membership=true&simple=true&per_page=100&page={page}&order_by=path&sort=asc",
                    cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync(cancellationToken);
                    return Result.Fail($"GitLab responded with status {(int)response.StatusCode}: {err}");
                }

                var items = await response.Content.ReadFromJsonAsync<List<JsonElement>>(
                    cancellationToken: cancellationToken) ?? [];
                if (items.Count == 0) break;

                foreach (var item in items)
                {
                    var id = item.TryGetProperty("id", out var idP) ? idP.GetInt64() : 0;
                    var path = item.TryGetProperty("path_with_namespace", out var pathP)
                        ? pathP.GetString() ?? string.Empty
                        : string.Empty;
                    var httpUrl = item.TryGetProperty("http_url_to_repo", out var httpP)
                        ? httpP.GetString() ?? string.Empty
                        : string.Empty;
                    var webUrl = item.TryGetProperty("web_url", out var webP)
                        ? webP.GetString() ?? string.Empty
                        : string.Empty;
                    var branch = item.TryGetProperty("default_branch", out var brP)
                        ? brP.GetString() ?? "main"
                        : "main";
                    var vis = item.TryGetProperty("visibility", out var visP)
                        ? visP.GetString() ?? "private"
                        : "private";

                    if (string.IsNullOrEmpty(httpUrl) && !string.IsNullOrEmpty(path))
                        httpUrl = $"https://gitlab.com/{path}.git";

                    result.Add(new GitLabProject
                    {
                        Id = id,
                        PathWithNamespace = path,
                        HttpUrlToRepo = httpUrl,
                        WebUrl = webUrl,
                        DefaultBranch = branch ?? "main",
                        Visibility = vis ?? "private"
                    });
                }

                page++;
                if (page > 50) break;
            }

            return Result.Ok(result);
        }
        catch (Exception e)
        {
            return Result.Fail(e.Message);
        }
    }

    /// <summary>
    /// Create an issue. <paramref name="projectIdOrPath"/> is either a numeric project id
    /// or a path_with_namespace (e.g. group/project) — same as GitLab REST API.
    /// </summary>
    public async Task<Result<GitLabIssueResponse>> CreateIssueAsync(
        string projectIdOrPath,
        GitLabIssueRequest issue,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var projectKey = EncodeProjectId(projectIdOrPath);
            var response = await httpClient.PostAsJsonAsync(
                $"projects/{projectKey}/issues",
                issue,
                cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync(cancellationToken);
                return Result.Fail($"GitLab responded with status {(int)response.StatusCode}: {err}");
            }

            var created = await response.Content.ReadFromJsonAsync<GitLabIssueResponse>(
                cancellationToken: cancellationToken);
            if (created == null)
                return Result.Fail("GitLab returned an empty issue response");
            return Result.Ok(created);
        }
        catch (Exception e)
        {
            return Result.Fail(e.Message);
        }
    }

    /// <summary>GitLab project paths must have / encoded as %2F in the URL path segment.</summary>
    public static string EncodeProjectId(string projectIdOrPath)
    {
        var s = (projectIdOrPath ?? "").Trim().TrimStart('/');
        if (string.IsNullOrEmpty(s)) return s;
        // Numeric id — leave as-is
        if (long.TryParse(s, out _)) return s;
        // path_with_namespace: encode each segment join as %2F without double-encoding
        return Uri.EscapeDataString(s);
    }
}
