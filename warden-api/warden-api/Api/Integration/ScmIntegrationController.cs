using Warden.Application.Exceptions;
using Warden.Application.Module.Integration.Scm;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Integration;

/// <summary>
/// SCM discovery + bulk import for GitHub/GitLab — list all accessible repos and
/// queue fleet scanners against each clone URL.
/// </summary>
[Route("api/integration/scm")]
[ApiExplorerSettings(GroupName = "Integration")]
public class ScmIntegrationController(IScmImportService scmImport) : BaseController
{
    /// <summary>List repositories the saved GitHub/GitLab token can access.</summary>
    [HttpGet]
    [Route("{provider}/repos")]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public async Task<List<ScmRepoInfo>> ListRepos(string provider, CancellationToken cancellationToken)
    {
        try
        {
            return await scmImport.ListReposAsync(provider, cancellationToken);
        }
        catch (Exception ex)
        {
            throw new BadRequestException(ex.Message);
        }
    }

    /// <summary>
    /// Import selected (or all) repos as Warden projects and queue scan jobs.
    /// Body: { provider, importAll?, repoIds?, scanners? }
    /// </summary>
    [HttpPost]
    [Route("import")]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public async Task<ImportScmReposResponse> ImportRepos(
        [FromBody] ImportScmReposRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return await scmImport.ImportAsync(request, cancellationToken);
        }
        catch (Exception ex)
        {
            throw new BadRequestException(ex.Message);
        }
    }
}
