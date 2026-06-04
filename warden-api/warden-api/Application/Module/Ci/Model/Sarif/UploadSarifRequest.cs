using System.ComponentModel.DataAnnotations;

namespace Warden.Application.Module.Ci.Model.Sarif;

public record UploadSarifRequest
{
    // The scan metadata (scanner name, type, repo/commit info). Reuses the exact
    // same shape the existing CI ingest path uses so the scan is created via
    // ICiService.CreateCiScanAsync and dedup/lifecycle behave identically.
    [Required] public required CiScanRequest Scan { get; set; }

    // Raw SARIF 2.1.0 log produced by any SARIF-emitting scanner.
    [Required] public required SarifLog Sarif { get; set; }
}
