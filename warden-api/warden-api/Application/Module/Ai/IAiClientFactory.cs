using Warden.Application.Module.Setting;
using Microsoft.Extensions.AI;

namespace Warden.Application.Module.Ai;

public interface IAiClientFactory
{
    /// <summary>Returns a chat client for the configured provider, or null when AI is disabled or unconfigured.</summary>
    Task<IChatClient?> CreateChatClientAsync();

    /// <summary>Returns an embedding generator for the configured provider, or null when AI/embeddings are disabled or unconfigured.</summary>
    Task<IEmbeddingGenerator<string, Embedding<float>>?> CreateEmbeddingGeneratorAsync();

    /// <summary>Builds a chat client from explicit settings (used by the Test Connection action so
    /// the user tests what they typed, not the saved config). Returns null when model is missing.</summary>
    IChatClient? CreateChatClient(AiSetting setting);
}
