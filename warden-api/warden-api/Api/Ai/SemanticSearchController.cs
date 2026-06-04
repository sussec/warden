using Microsoft.AspNetCore.Mvc;
using Warden.Application.Module.Ai.Vector;
using Warden.Authentication;

namespace Warden.Api.Ai;

public sealed record SemanticSearchRequest
{
    public required string Query { get; init; }
    public Guid? ProjectId { get; init; }
    public int? Top { get; init; }
}

public sealed record BackfillResponse
{
    public required int Processed { get; init; }
}

[Route("api/ai/semantic-search")]
[ApiExplorerSettings(GroupName = "Ai")]
public class SemanticSearchController(
    ISemanticSearchService semanticSearchService,
    FindingEmbeddingBackfillService backfillService) : BaseController
{
    [HttpPost]
    public async Task<List<SemanticSearchResult>> Search([FromBody] SemanticSearchRequest request)
    {
        var top = request.Top is > 0 ? request.Top.Value : 20;
        return await semanticSearchService.SearchFindingsAsync(request.Query, request.ProjectId, top);
    }

    [HttpPost]
    [Route("backfill")]
    [Permission(PermissionType.Config, PermissionAction.Update)]
    public async Task<BackfillResponse> Backfill()
    {
        var processed = await backfillService.BackfillAsync();
        return new BackfillResponse { Processed = processed };
    }
}
