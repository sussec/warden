using FluentResults;

namespace Warden.Application.Module.Integration;

public interface IAlertFixedFinding
{
    Task<Result<bool>> AlertAsync(List<string> receivers, AlertStatusFindingModel model);

}