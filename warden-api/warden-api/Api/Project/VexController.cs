using System.Net.Mime;
using Warden.Application.Module.Project;
using Warden.Application.Module.Project.Vex;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Project;

[Route("api/project")]
[ApiExplorerSettings(GroupName = "Project")]
public class VexController(
    IProjectAuthorize projectAuthorize,
    IVexService vexService) : BaseController
{
    /// <summary>
    /// Export the project's triage decisions as an OpenVEX v0.2.0 document.
    /// False positives map to not_affected, accepted risks to affected, and
    /// fixed findings to fixed — feed it to Grype/Trivy/osv-scanner to
    /// suppress already-assessed advisories in CI.
    /// </summary>
    [HttpGet]
    [Route("{projectId:guid}/vex")]
    [Produces(MediaTypeNames.Application.Json)]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<FileContentResult> GetVex(Guid projectId)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Read);
        var document = await vexService.GenerateVexAsync(projectId);
        return new FileContentResult(document.Content, MediaTypeNames.Application.Json)
        {
            FileDownloadName = $"{document.ProjectName}-openvex.json"
        };
    }
}
