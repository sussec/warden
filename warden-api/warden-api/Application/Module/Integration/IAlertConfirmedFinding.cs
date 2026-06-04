using Warden.Application.Helpers;
using Warden.Core.Entity;
using Warden.Core.Enum;
using FluentResults;

namespace Warden.Application.Module.Integration;

public record AlertConfirmedFindingModel
{
    public required Projects Project { get; set; }
    public required List<Findings> Findings { get; set; }

    public string ProjectUrl()
    {
        return FrontendUrlHelper.ProjectUrl(Project.Id);
    }

    public string FindingUrl()
    {
        var findingUrl = $"{FrontendUrlHelper.ProjectFindingUrl(Project.Id)}?status={FindingStatus.Open.ToString()}";

        return findingUrl;
    }
}

public interface IAlertConfirmedFinding
{
    Task<Result<bool>> AlertAsync(List<string> receivers, AlertConfirmedFindingModel model);
}