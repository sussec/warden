using Microsoft.Extensions.AI;

namespace Warden.Application.Module.Ai;

public interface IAiClientFactory
{
    /// <summary>Returns a chat client for the configured provider, or null when AI is disabled or unconfigured.</summary>
    Task<IChatClient?> CreateChatClientAsync();

    /// <summary>Returns an embedding generator for the configured provider, or null when AI/embeddings are disabled or unconfigured.</summary>
    Task<IEmbeddingGenerator<string, Embedding<float>>?> CreateEmbeddingGeneratorAsync();
}
