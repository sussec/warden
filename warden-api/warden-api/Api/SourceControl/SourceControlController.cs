using Warden.Application.Module.SourceControl;
using Warden.Application.Module.SourceControl.Model;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.SourceControl;

public class SourceControlController(ISourceControlService sourceControlService) : BaseController
{
    [HttpGet]
    public Task<List<SourceControlSummary>> GetSourceControlSystem()
    {
        return sourceControlService.ListSourceControlAsync();
    }
}