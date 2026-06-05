using System.ClientModel;
using Warden.Application.Module.Setting;
using Warden.Core.Enum;
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
        return CreateChatClient(setting);
    }

    public async Task<int> GetEmbeddingDimensionAsync()
    {
        var setting = await context.GetAiSettingAsync();
        return setting.EmbeddingDimension > 0 ? setting.EmbeddingDimension : 1536;
    }

    public IChatClient? CreateChatClient(AiSetting setting)
    {
        if (string.IsNullOrEmpty(setting.Model))
        {
            return null;
        }
        return setting.Provider switch
        {
            AiProvider.Anthropic => CreateAnthropicClient(setting),
            _ => CreateOpenAiClient(setting.Endpoint, setting.ApiKey)
                .GetChatClient(setting.Model).AsIChatClient(),
        };
    }

    public async Task<IEmbeddingGenerator<string, Embedding<float>>?> CreateEmbeddingGeneratorAsync()
    {
        var setting = await context.GetAiSettingAsync();
        if (!setting.Enabled || string.IsNullOrEmpty(setting.EmbeddingModel))
        {
            return null;
        }
        // Embeddings always use an OpenAI-compatible endpoint (Anthropic has none).
        // Use the dedicated embedding endpoint/key when set, otherwise reuse the chat
        // endpoint — only valid when the chat provider is itself OpenAI-compatible.
        if (setting.Provider == AiProvider.Anthropic && string.IsNullOrEmpty(setting.EmbeddingEndpoint))
        {
            // No OpenAI-compatible endpoint available for embeddings — semantic search off.
            return null;
        }
        var endpoint = string.IsNullOrEmpty(setting.EmbeddingEndpoint)
            ? setting.Endpoint
            : setting.EmbeddingEndpoint;
        var apiKey = string.IsNullOrEmpty(setting.EmbeddingApiKey)
            ? setting.ApiKey
            : setting.EmbeddingApiKey;
        return CreateOpenAiClient(endpoint, apiKey)
            .GetEmbeddingClient(setting.EmbeddingModel).AsIEmbeddingGenerator();
    }

    private static OpenAIClient CreateOpenAiClient(string endpoint, string apiKey)
    {
        // Local OpenAI-compatible servers (Ollama, LM Studio, Foundry Local) accept any key.
        var credential = new ApiKeyCredential(string.IsNullOrEmpty(apiKey) ? "warden" : apiKey);
        var options = new OpenAIClientOptions();
        if (!string.IsNullOrEmpty(endpoint))
        {
            options.Endpoint = new Uri(endpoint);
        }
        return new OpenAIClient(credential, options);
    }

    private static IChatClient CreateAnthropicClient(AiSetting setting)
    {
        return new AnthropicChatClient(setting.Endpoint, setting.ApiKey, setting.Model);
    }
}
