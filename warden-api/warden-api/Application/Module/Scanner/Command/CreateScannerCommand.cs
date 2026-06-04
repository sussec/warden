using Warden.Application.Module.Scanner.Model;
using Warden.Core.Entity;
using Warden.Core.Extension;
using FluentResults;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Scanner.Command;

public class CreateScannerCommand(AppDbContext context)
{
    public async Task<Result<Scanners>> ExecuteAsync(CreateScannerRequest request)
    {
        var normalizeName = request.Name.NormalizeUpper();
        var scanner = await context.Scanners.FirstOrDefaultAsync(x =>
            x.NormalizedName == normalizeName && x.Type == request.Type);
        if (scanner != null)
        {
            return scanner;
        }

        scanner = new Scanners
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Type = request.Type,
            NormalizedName = normalizeName
        };
        context.Scanners.Add(scanner);
        await context.SaveChangesAsync();
        return scanner;
    }
}