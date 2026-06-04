using Warden.Application.Module.Project;
using Warden.Application.Module.Project.Model;
using Warden.Authentication;
using Warden.Core.Entity;
using Warden.Core.EntityFramework;
using Warden.Core.Enum;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Project;

[Route("api/project")]
[ApiExplorerSettings(GroupName = "Project")]
public class ProjectPackageController(
    IProjectAuthorize projectAuthorize,
    IProjectPackageService projectPackageService) : BaseController
{
    [HttpPost]
    [Route("{projectId}/package/filter")]
    public async Task<Page<ProjectPackage>> GetProjectPackages(Guid projectId, ProjectPackageFilter filter)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Read);
        return await projectPackageService.GetProjectPackageByFilterAsync(projectId, filter);
    }

    [HttpGet]
    [Route("{projectId:guid}/package/{packageId:guid}")]
    public async Task<ProjectPackageDetailResponse> GetProjectPackageDetail(Guid projectId, Guid packageId)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Read);
        return await projectPackageService.GetProjectPackageDetailAsync(projectId, packageId);
    }

    [HttpPatch]
    [Route("{projectId:guid}/package/{packageId:guid}")]
    public async Task<ProjectPackageDetailResponse> UpdateProjectPackage(Guid projectId, Guid packageId,
        UpdateProjectPackageRequest request)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        return await projectPackageService.UpdateProjectPackageAsync(projectId, packageId, request);
    }

    [HttpPost]
    [Route("{projectId:guid}/package/{packageId:guid}/ticket")]
    public async Task<Tickets> CreateProjectPackageTicket(Guid projectId, Guid packageId, TicketType ticketType)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        return await projectPackageService.CreateProjectPackageTicketAsync(new CreateProjectPackageTicketRequest
        {
            TicketType = ticketType,
            ProjectId = projectId,
            PackageId = packageId
        });
    }

    [HttpDelete]
    [Route("{projectId:guid}/package/{packageId:guid}/ticket")]
    public async Task<bool> DeleteProjectTicket(Guid projectId, Guid packageId)
    {
        projectAuthorize.Authorize(projectId, CurrentUser, PermissionAction.Update);
        return await projectPackageService.DeleteProjectPackageTicketAsync(projectId, packageId);
    }
}