using Warden.Application.Module.Ci.Command;
using Warden.Application.Module.Ci.Model;
using Warden.Core.Extension;
using Microsoft.Extensions.Logging;

namespace Warden.Application.Module.Ci;

public interface ICiService
{
    Task<CiScanInfo> CreateCiScanAsync(CiScanRequest request);
    Task<bool> UpdateCiScanAsync(Guid scanId, UpdateCiScanRequest request);

    Task<UploadCiFindingResponse> UploadFinding(UploadCiFindingRequest request);
    Task<ScanDependencyResult> PushCiDependencyAsync(UploadCiDependencyRequest request);
}

public class CiService(
    IServiceProvider serviceProvider,
    AppDbContext context,
    ILogger<PushCiDependencyCommand> dependencyLogger
) : ICiService
{
    public async Task<CiScanInfo> CreateCiScanAsync(CiScanRequest request)
    {
        return (await new CreateCiScanCommand(context)
            .ExecuteAsync(request)).GetResult();
    }

    public async Task<bool> UpdateCiScanAsync(Guid scanId, UpdateCiScanRequest request)
    {
        return (await new UpdateCiScanCommand(context)
            .ExecuteAsync(scanId, request)).GetResult();
    }

    public async Task<UploadCiFindingResponse> UploadFinding(UploadCiFindingRequest request)
    {
        return (await new PushCiFindingCommand(serviceProvider)
            .ExecuteAsync(request)).GetResult();
    }

    public Task<ScanDependencyResult> PushCiDependencyAsync(UploadCiDependencyRequest request)
    {
        return new PushCiDependencyCommand(context, dependencyLogger).ExecuteAsync(request);
    }
}