using System.ClientModel;
using Warden.Application.Module.Setting;
using Microsoft.Extensions.AI;
using OpenAI;

namespace Warden.Application.Module.Ai;

public class AiClientFactory(AppDbContext context) : IAiClientFactory
{
    public async Task<IChatClient?> CreateChatClientAsync()
    {
        var setting = await context.GetAiSettingAsync();
        if (!setting.Enabled || string.IsNullOrEmpty(setting.Model))
        {
            return null;
        }
        return CreateOpenAiClient(setting).GetChatClient(setting.Model).AsIChatClient();
    }

    public async Task<IEmbeddingGenerator<string, Embedding<float>>?> CreateEmbeddingGeneratorAsync()
    {
        var setting = await context.GetAiSettingAsync();
        if (!setting.Enabled || string.IsNullOrEmpty(setting.EmbeddingModel))
        {
            return null;
        }
        return CreateOpenAiClient(setting).GetEmbeddingClient(setting.EmbeddingModel).AsIEmbeddingGenerator();
    }

    private static OpenAIClient CreateOpenAiClient(AiSetting setting)
    {
        // Local OpenAI-compatible servers (Ollama, LM Studio, Foundry Local) accept any key.
        var credential = new ApiKeyCredential(string.IsNullOrEmpty(setting.ApiKey) ? "warden" : setting.ApiKey);
        var options = new OpenAIClientOptions();
        if (!string.IsNullOrEmpty(setting.Endpoint))
        {
            options.Endpoint = new Uri(setting.Endpoint);
        }
        return new OpenAIClient(credential, options);
    }
}
