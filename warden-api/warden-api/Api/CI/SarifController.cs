using Warden.Application.Module.Ci;
using Warden.Application.Module.Ci.Model;
using Warden.Application.Module.Ci.Model.Sarif;
using Warden.Core.Enum;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.CI;

// Generic SARIF 2.1.0 ingestion endpoint. Lets any SARIF-producing scanner
// (CodeQL, Bandit, gosec, Checkov, ZAP, ...) push findings without a custom
// wrapper. Authorized identically to CiController (CI-TOKEN header) and funnels
// into the same ICiService so dedup/lifecycle behave exactly as the native path.
[ApiController]
[Route("api/ci")]
[AllowAnonymous]
[CiAuthorize]
[Produces("application/json")]
[Consumes("application/json")]
public class SarifController(ICiService ciService)
{
    [HttpPost]
    [Route("sarif")]
    public async Task<UploadCiFindingResponse> UploadSarif(UploadSarifRequest request)
    {
        // 1. Create (or resume) the scan via the same command CiController uses.
        var scanInfo = await ciService.CreateCiScanAsync(request.Scan);

        // 2. Map the SARIF log to the existing CiFinding model.
        var findings = SarifMapper.Map(request.Sarif);

        // 3. Push findings through the existing ingest pipeline (dedup + lifecycle).
        var response = await ciService.UploadFinding(new UploadCiFindingRequest
        {
            ScanId = scanInfo.ScanId,
            Findings = findings,
            Strategy = ScanStrategy.AllFiles
        });

        // 4. Mark the scan completed.
        await ciService.UpdateCiScanAsync(scanInfo.ScanId, new UpdateCiScanRequest
        {
            Status = ScanStatus.Completed
        });

        return response;
    }
}
