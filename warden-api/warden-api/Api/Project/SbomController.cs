using System.Net.Mime;
using Warden.Application.Module.Project;
using Warden.Application.Module.Project.Sbom;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Project;

[Route("api/project")]
[ApiExplorerSettings(GroupName = "Project")]
public class SbomController(
    IProjectAuthorize projectAuthorize,
    ISbomService sbomService) : BaseController
{
    /// <summary>
    /// Export a project's package inventory as a CycloneDX 1.5 JSON SBOM.
    /// By default the latest scan on the project's default branch is used;
    /// pass <paramref name="branch"/> or <paramref name="commitId"/> to pin a specific scan.
    /// </summary>
    [HttpGet]
    [Route("{projectId:guid}/sbom")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<FileContentResult> GetSbom(
        Guid projectId,
        [FromQuery] string? branch,
        [FromQuery] Guid? commitId)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Read);
        var document = await sbomService.GenerateSbomAsync(projectId, branch, commitId);
        return new FileContentResult(document.Content, MediaTypeNames.Application.Json)
        {
            FileDownloadName = $"{document.ProjectName}-sbom.cdx.json"
        };
    }
}
