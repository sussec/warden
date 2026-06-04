using Warden.Application.Module.SourceControl.Command;
using Warden.Application.Module.SourceControl.Model;
using Warden.Core.Entity;
using FluentResults;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.SourceControl;

public static class SourceControlExtension
{
    public static Task<Result<SourceControls>> CreateSourceControlsAsync(this AppDbContext context,
        CreateSourceControlRequest request)
    {
        return new CreateSourceControlCommand(context).ExecuteAsync(request);
    }

    public static async Task<Result<SourceControls>> GetSourceControlsByIdAsync(this AppDbContext context, Guid id)
    {
        var source = await context.SourceControls.FirstOrDefaultAsync(x => x.Id == id);
        if (source != null)
        {
            return source;
        }

        return Result.Fail("SourceControl not found");
    }
}