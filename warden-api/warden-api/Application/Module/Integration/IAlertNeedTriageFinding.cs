using Warden.Application.Helpers;
using Warden.Core.Entity;
using Warden.Core.Enum;
using FluentResults;

namespace Warden.Application.Module.Integration;

public record AlertNeedTriageFindingModel
{
    public required Projects Project { get; set; }
    public required int NeedTriageCount { get; set; }

    public string FindingUrl()
    {
        return $"{FrontendUrlHelper.ProjectFindingUrl(Project.Id)}?status={FindingStatus.Open.ToString()}";
    }
}
public interface IAlertNeedTriageFinding
{
    Task<Result<bool>> AlertAsync(List<string> receivers, AlertNeedTriageFindingModel model);
}