using Warden.Application.Module.Scan;
using Warden.Application.Module.Scan.Model;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Scan;

/// <summary>
/// UI-first scan jobs: create from the browser, worker runs them, stream shows live logs.
/// No CLI required for operators.
/// </summary>
[Route("api/scan-job")]
public class ScanJobController(IScanJobService scanJobService) : BaseController
{
    [HttpPost]
    [Route("")]
    public async Task<ActionResult<ScanJobInfo>> CreateScanJob(CreateScanJobRequest request)
    {
        try
        {
            return await scanJobService.CreateAsync(request);
        }
        catch (ArgumentException e)
        {
            return BadRequest(new { message = e.Message });
        }
        catch (InvalidOperationException e)
        {
            return Conflict(new { message = e.Message });
        }
    }

    [HttpPost]
    [Route("filter")]
    public Task<List<ScanJobInfo>> GetScanJobs(ScanJobFilter filter)
    {
        return scanJobService.ListAsync(filter);
    }

    /// <summary>Runner readiness for the fleet UI (backend kind, token, images).</summary>
    [HttpGet]
    [Route("capability")]
    public Task<ScanRunnerCapability> GetCapability(CancellationToken cancellationToken)
    {
        return scanJobService.GetCapabilityAsync(cancellationToken);
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
