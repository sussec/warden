using Warden.Application.Module.Scanner.Model;
using Warden.Core.Entity;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Scanner;

public interface IScannerService
{
    Task<List<Scanners>> ListScannersAsync(ScannerFilter filter);
}

public class ScannerService(AppDbContext context) : IScannerService
{
    public Task<List<Scanners>> ListScannersAsync(ScannerFilter filter)
    {
        return context.Scanners
            .ScannerFilter(context, filter)
            .Distinct()
            .ToListAsync();
    }
}