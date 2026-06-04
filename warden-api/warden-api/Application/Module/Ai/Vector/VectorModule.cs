using Warden.Core;

namespace Warden.Application.Module.Ai.Vector;

public class VectorModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        builder.AddScoped<FindingVectorStore>();
        builder.AddScoped<ISemanticSearchService, SemanticSearchService>();
        builder.AddScoped<FindingEmbeddingBackfillService>();
        return builder;
    }
}
