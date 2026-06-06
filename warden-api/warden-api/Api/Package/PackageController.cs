using Warden.Application.Module.Osv;
using Warden.Application.Module.Osv.Model;
using Warden.Application.Module.Package;
using Warden.Application.Module.Package.Model;
using Warden.Application.Module.Project.Model;
using Warden.Core.EntityFramework;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Package;

public class PackageController(
    IPackageService packageService,
    IOsvAdvisoryService osvAdvisoryService
) : BaseController
{
    [HttpPost]
    [Route("filter")]
    public Task<Page<ProjectPackage>> GetPackagesByFilter(PackageFilter filter)
    {
        return packageService.GetPackagesByFilterAsync(filter);
    }

    [HttpGet]
    [Route("{packageId:guid}/dependencies")]
    public Task<List<PackageInfo>> ListPackageDependency(Guid packageId)
    {
        return packageService.ListPackageDependencyAsync(packageId);
    }

    [HttpGet]
    [Route("{packageId:guid}")]
    public Task<PackageDetail> GetPackageById(Guid packageId)
    {
        return packageService.GetPackageByIdAsync(packageId);
    }

    /// <summary>
    /// Live OSV.dev advisories for this package version — independent of scanner
    /// findings, so it also surfaces advisories published after the last scan.
    /// Empty list when the OSV service is disabled.
    /// </summary>
    [HttpGet]
    [Route("{packageId:guid}/advisories")]
    public async Task<List<OsvAdvisory>> GetPackageAdvisories(Guid packageId, CancellationToken cancellationToken)
    {
        if (!osvAdvisoryService.Enabled)
        {
            return [];
        }
        var detail = await packageService.GetPackageByIdAsync(packageId);
        var pkg = detail.Info;
        return await osvAdvisoryService.GetPackageAdvisoriesAsync(
            pkg.Type, pkg.Group, pkg.Name, pkg.Version, cancellationToken);
    }
}
