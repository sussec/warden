using Warden.Core.Extension;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Project.Sbom;

public record SbomDocument
{
    public required string ProjectName { get; init; }
    public required byte[] Content { get; init; }
}

public interface ISbomService
{
    Task<SbomDocument> GenerateSbomAsync(Guid projectId, string? branch, Guid? commitId);
}

public class SbomService(AppDbContext context) : ISbomService
{
    public async Task<SbomDocument> GenerateSbomAsync(Guid projectId, string? branch, Guid? commitId)
    {
        var content = (await new GenerateSbomCommand(context)
            .ExecuteAsync(projectId, branch, commitId)).GetResult();

        var projectName = await context.Projects
            .Where(record => record.Id == projectId)
            .Select(record => record.Name)
            .FirstOrDefaultAsync() ?? "project";

        return new SbomDocument
        {
            ProjectName = projectName,
            Content = content
        };
    }
}
