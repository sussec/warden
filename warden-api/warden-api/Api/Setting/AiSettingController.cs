using Warden.Application;
using Warden.Application.Module.Ai;
using Warden.Application.Module.Setting;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.AI;

namespace Warden.Api.Setting;

[Route("api/setting/ai")]
[ApiExplorerSettings(GroupName = "Setting")]
public class AiSettingController(AppDbContext context, IAiClientFactory aiClientFactory) : BaseController
{
    [HttpGet]
    [Permission(PermissionType.Config, PermissionAction.Read)]
    public async Task<AiSetting> GetAiSetting()
    {
        var setting = await context.GetAiSettingAsync();
        return setting with { ApiKey = string.Empty };
    }

    [HttpPost]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public async Task UpdateAiSetting([FromBody] AiSetting request)
    {
        await context.UpdateAiSettingAsync(request);
    }

    [HttpPost]
    [Route("test")]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public async Task<bool> TestAiSetting()
    {
        var chatClient = await aiClientFactory.CreateChatClientAsync();
        if (chatClient == null)
        {
            return false;
        }
        var response = await chatClient.GetResponseAsync([new ChatMessage(ChatRole.User, "Reply with the single word: ok")]);
        return !string.IsNullOrEmpty(response.Text);
    }
}
