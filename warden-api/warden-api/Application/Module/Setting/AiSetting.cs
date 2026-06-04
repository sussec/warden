namespace Warden.Application.Module.Setting;

/// <summary>
/// AI provider configuration. Any OpenAI-compatible endpoint is supported:
/// OpenAI, Azure OpenAI, Ollama (http://host:11434/v1), LM Studio, Foundry Local, vLLM, etc.
/// Disabled by default — no finding data leaves the system unless explicitly enabled.
/// </summary>
public record AiSetting
{
    public bool Enabled { get; set; }
    /// <summary>OpenAI-compatible base URL. Empty = api.openai.com.</summary>
    public string Endpoint { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    /// <summary>Chat model used for remediation suggestions and triage (e.g. gpt-4.1-mini, llama3.3).</summary>
    public string Model { get; set; } = string.Empty;
    /// <summary>Embedding model used for semantic search (e.g. text-embedding-3-small, nomic-embed-text).</summary>
    public string EmbeddingModel { get; set; } = string.Empty;
}
