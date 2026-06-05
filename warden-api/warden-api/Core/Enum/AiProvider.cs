using System.Text.Json.Serialization;

namespace Warden.Core.Enum;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AiProvider
{
    /// <summary>OpenAI and any OpenAI-compatible endpoint (Azure, Ollama, OpenRouter, vLLM, LM Studio, z.ai /v4, …).</summary>
    OpenAiCompatible,

    /// <summary>Anthropic Messages API (api.anthropic.com or an Anthropic-compatible gateway).</summary>
    Anthropic,

    /// <summary>Azure OpenAI deployment (uses the deployment name as the model).</summary>
    AzureOpenAi,
}
