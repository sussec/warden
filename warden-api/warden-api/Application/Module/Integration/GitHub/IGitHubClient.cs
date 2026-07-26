using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentResults;

namespace Warden.Application.Module.Integration.GitHub;

public record GitHubIssueRequest
{
    [JsonPropertyName("title")] public required string Title { get; set; }
    [JsonPropertyName("body")] public required string Body { get; set; }
    [JsonPropertyName("labels")] public List<string> Labels { get; set; } = [];
}

public record GitHubIssueResponse
{
    [JsonPropertyName("number")] public long Number { get; set; }
    [JsonPropertyName("html_url")] public string HtmlUrl { get; set; } = string.Empty;
}

public interface IGitHubClient
{
    Task<Result<bool>> TestConnectionAsync();
    Task<Result<GitHubMetadata>> GetMetadataAsync(bool reload);
    Task<Result<GitHubIssueResponse>> CreateIssueAsync(string owner, string repo, GitHubIssueRequest issue);
}

public class GitHubClient : IGitHubClient
{
    private static List<GitHubRepository>? repositories;
    private readonly HttpClient httpClient;

    public GitHubClient(string apiUrl, string token)
    {
        if (string.IsNullOrEmpty(apiUrl))
        {
            apiUrl = "https://api.github.com";
        }

        httpClient = new HttpClient
        {
            BaseAddress = new Uri(apiUrl.TrimEnd('/') + "/")
        };
        httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Warden");
        if (!string.IsNullOrEmpty(token))
        {
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
    }

    public GitHubClient(IHttpClientFactory httpClientFactory, string apiUrl, string token)
    {
        if (string.IsNullOrEmpty(apiUrl))
        {
            apiUrl = "https://api.github.com";
        }

        httpClient = httpClientFactory.CreateClient();
        httpClient.BaseAddress = new Uri(apiUrl.TrimEnd('/') + "/");
        httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Warden");
        if (!string.IsNullOrEmpty(token))
        {
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
    }

    public async Task<Result<bool>> TestConnectionAsync()
    {
        try
        {
            var response = await httpClient.GetAsync("user");
            return response.IsSuccessStatusCode
                ? Result.Ok(true)
                : Result.Fail($"GitHub responded with status {(int)response.StatusCode}");
        }
        catch (Exception e)
        {
            return Result.Fail(e.Message);
        }
    }

    public async Task<Result<GitHubMetadata>> GetMetadataAsync(bool reload)
    {
        if (reload || repositories == null)
        {
            try
            {
                var result = new List<GitHubRepository>();
                var page = 1;
                // affiliation: personal + collab + org (production PAT / fine-grained).
                // visibility=all includes private repos the token can read.
                while (true)
                {
                    var response = await httpClient.GetAsync(
                        $"user/repos?per_page=100&page={page}&sort=full_name" +
                        "&affiliation=owner,collaborator,organization_member&visibility=all");
                    if (!response.IsSuccessStatusCode)
                    {
                        var err = await response.Content.ReadAsStringAsync();
                        return Result.Fail(
                            $"GitHub responded with status {(int)response.StatusCode}: {err}");
                    }

                    var items = await response.Content.ReadFromJsonAsync<List<JsonElement>>() ?? [];
                    if (items.Count == 0)
                    {
                        break;
                    }

                    foreach (var item in items)
                    {
                        var fullName = item.TryGetProperty("full_name", out var fullNameProperty)
                            ? fullNameProperty.GetString() ?? string.Empty
                            : string.Empty;
                        var name = item.TryGetProperty("name", out var nameProperty)
                            ? nameProperty.GetString() ?? string.Empty
                            : string.Empty;
                        var owner = string.Empty;
                        if (item.TryGetProperty("owner", out var ownerProperty) &&
                            ownerProperty.TryGetProperty("login", out var loginProperty))
                        {
                            owner = loginProperty.GetString() ?? string.Empty;
                        }

                        var cloneUrl = item.TryGetProperty("clone_url", out var cloneProp)
                            ? cloneProp.GetString() ?? string.Empty
                            : string.Empty;
                        if (string.IsNullOrEmpty(cloneUrl) && !string.IsNullOrEmpty(fullName))
                            cloneUrl = $"https://github.com/{fullName}.git";

                        var htmlUrl = item.TryGetProperty("html_url", out var htmlProp)
                            ? htmlProp.GetString() ?? string.Empty
                            : string.Empty;
                        var defaultBranch = item.TryGetProperty("default_branch", out var branchProp)
                            ? branchProp.GetString() ?? "main"
                            : "main";
                        var isPrivate = item.TryGetProperty("private", out var privProp) &&
                                        privProp.ValueKind == JsonValueKind.True;
                        var id = item.TryGetProperty("id", out var idProp) ? idProp.GetInt64() : 0L;

                        result.Add(new GitHubRepository
                        {
                            Owner = owner,
                            Name = name,
                            FullName = fullName,
                            CloneUrl = cloneUrl,
                            HtmlUrl = htmlUrl,
                            DefaultBranch = defaultBranch,
                            Private = isPrivate,
                            Id = id
                        });
                    }

                    page++;
                    if (page > 50) break; // hard cap ~5k repos
                }

                repositories = result;
            }
            catch (Exception e)
            {
                return Result.Fail(e.Message);
            }
        }

        return Result.Ok(new GitHubMetadata { Repositories = repositories });
    }

    public async Task<Result<GitHubIssueResponse>> CreateIssueAsync(string owner, string repo,
        GitHubIssueRequest issue)
    {
        try
        {
            var response = await httpClient.PostAsJsonAsync($"repos/{owner}/{repo}/issues", issue);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                return Result.Fail($"GitHub responded with status {(int)response.StatusCode}: {error}");
            }

            var created = await response.Content.ReadFromJsonAsync<GitHubIssueResponse>();
            if (created == null)
            {
                return Result.Fail("GitHub returned an empty issue response");
            }

            return Result.Ok(created);
        }
        catch (Exception e)
        {
            return Result.Fail(e.Message);
        }
    }
}
