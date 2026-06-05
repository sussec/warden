using Warden.Core.Enum;

namespace Warden.Application.Module.Setting;

/// <summary>
/// AI provider configuration. Supports OpenAI and any OpenAI-compatible endpoint
/// (Azure, Ollama, OpenRouter, vLLM, LM Studio, z.ai, …) and the native Anthropic
/// Messages API. Embeddings (semantic search) always use an OpenAI-compatible
/// endpoint — set the dedicated embedding fields when the chat provider has none
/// (e.g. Anthropic). Disabled by default — no finding data leaves the system
/// unless explicitly enabled.
/// </summary>
public record AiSetting
{
    public bool Enabled { get; set; }

    /// <summary>Chat provider type. Defaults to OpenAI-compatible.</summary>
    public AiProvider Provider { get; set; } = AiProvider.OpenAiCompatible;

    /// <summary>Base URL of the chat provider. Empty = provider default (e.g. api.openai.com).</summary>
    public string Endpoint { get; set; } = string.Empty;

    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Chat model used for remediation suggestions and triage (e.g. gpt-4.1-mini, claude-sonnet-4-6, glm-5.1).</summary>
    public string Model { get; set; } = string.Empty;

    /// <summary>Embedding model used for semantic search (e.g. text-embedding-3-small, nomic-embed-text).</summary>
    public string EmbeddingModel { get; set; } = string.Empty;

    /// <summary>
    /// Optional OpenAI-compatible base URL for embeddings, when it differs from the chat
    /// endpoint (required when the chat provider is Anthropic, which has no embeddings API).
    /// Empty = reuse the chat endpoint/key (only valid for OpenAI-compatible chat providers).
    /// </summary>
    public string EmbeddingEndpoint { get; set; } = string.Empty;

    /// <summary>Optional API key for the embeddings endpoint. Empty = reuse the chat key.</summary>
    public string EmbeddingApiKey { get; set; } = string.Empty;
}
