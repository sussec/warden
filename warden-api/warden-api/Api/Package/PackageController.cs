using Warden.Application.Module.Package;
using Warden.Application.Module.Package.Model;
using Warden.Application.Module.Project.Model;
using Warden.Core.EntityFramework;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Package;

public class PackageController(
    IPackageService packageService
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
}