using Warden.Application.Module.Scanner;
using Warden.Application.Module.Scanner.Model;
using Warden.Core.Entity;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Scanner;

public class ScannerController(
    IScannerService scannerService
) : BaseController
{
    [HttpPost]
    [Route("filter")]
    public Task<List<Scanners>> GetScanners(ScannerFilter filter)
    {
        return scannerService.ListScannersAsync(filter);
    }
}