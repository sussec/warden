using Warden.Core.Extension;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Project.Vex;

public record VexDocument
{
    public required string ProjectName { get; init; }
    public required byte[] Content { get; init; }
}

public interface IVexService
{
    Task<VexDocument> GenerateVexAsync(Guid projectId);
}

public class VexService(AppDbContext context) : IVexService
{
    public async Task<VexDocument> GenerateVexAsync(Guid projectId)
    {
        var content = (await new GenerateVexCommand(context)
            .ExecuteAsync(projectId)).GetResult();

        var projectName = await context.Projects
            .Where(record => record.Id == projectId)
            .Select(record => record.Name)
            .FirstOrDefaultAsync() ?? "project";

        return new VexDocument
        {
            ProjectName = projectName,
            Content = content
        };
    }
}
