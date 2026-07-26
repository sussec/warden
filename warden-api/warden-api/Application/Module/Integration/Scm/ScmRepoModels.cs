namespace Warden.Application.Module.Integration.Scm;

public class ScmRepoInfo
{
    public required string Provider { get; set; }
    public required string Id { get; set; }
    public required string FullName { get; set; }
    public required string CloneUrl { get; set; }
    public string HtmlUrl { get; set; } = string.Empty;
    public string DefaultBranch { get; set; } = "main";
    public bool Private { get; set; }
    public bool AlreadyImported { get; set; }
}

public class ImportScmReposRequest
{
    public required string Provider { get; set; }
    public List<string> RepoIds { get; set; } = [];
    public bool ImportAll { get; set; }
    public List<string> Scanners { get; set; } = ["gitleaks", "cve-lite", "trufflehog"];
}

public class ImportScmRepoResult
{
    public required string FullName { get; set; }
    public required string CloneUrl { get; set; }
    public Guid? ProjectId { get; set; }
    public bool Created { get; set; }
    public List<Guid> ScanJobIds { get; set; } = [];
    public string? Error { get; set; }
}

public class ImportScmReposResponse
{
    public int Imported { get; set; }
    public int Updated { get; set; }
    public int ScansQueued { get; set; }
    public List<ImportScmRepoResult> Results { get; set; } = [];
}
