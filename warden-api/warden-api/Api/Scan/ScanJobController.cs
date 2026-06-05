using Warden.Application.Module.Scan;
using Warden.Application.Module.Scan.Model;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Scan;

[Route("api/scan-job")]
public class ScanJobController(IScanJobService scanJobService) : BaseController
{
    [HttpPost]
    [Route("")]
    public Task<ScanJobInfo> CreateScanJob(CreateScanJobRequest request)
    {
        return scanJobService.CreateAsync(request);
    }

    [HttpPost]
    [Route("filter")]
    public Task<List<ScanJobInfo>> GetScanJobs(ScanJobFilter filter)
    {
        return scanJobService.ListAsync(filter);
    }

    [HttpGet]
    [Route("{scanJobId:guid}")]
    public async Task<ActionResult<ScanJobInfo>> GetScanJob(Guid scanJobId)
    {
        var job = await scanJobService.GetAsync(scanJobId);
        if (job == null) return NotFound();
        return job;
    }
}
