using Warden.Application.Module.Project.Model;
using Warden.Core.Entity;
using Warden.Core.Utils;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Project;

public static class ProjectExtension
{
    public static async Task<Projects> CreateProjectAsync(this AppDbContext context, Projects input)
    {
        var project = await context.Projects.FirstOrDefaultAsync(record =>
            record.SourceControlId == input.SourceControlId && record.RepoId == input.RepoId);
        if (project == null)
        {
            project = input;
            project.Id = Guid.NewGuid();
            context.Projects.Add(project);
            await context.SaveChangesAsync();
            var setting = new ProjectSettings
            {
                ProjectId = project.Id,
                SastSetting = JSONSerializer.Serialize(new ThresholdSetting()),
                ScaSetting = JSONSerializer.Serialize(new ThresholdSetting()),
            };
            context.ProjectSettings.Add(setting);
            await context.SaveChangesAsync();
        }
        else
        {
            if (project.Name != input.Name)
            {
                project.Name = input.Name;
            }

            if (project.RepoUrl != input.RepoUrl)
            {
                project.RepoUrl = input.RepoUrl;
            }

            context.Projects.Update(project);
            await context.SaveChangesAsync();
        }

        return project;
    }
}