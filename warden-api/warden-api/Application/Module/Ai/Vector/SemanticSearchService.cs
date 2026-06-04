using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Ai.Vector;

public sealed class SemanticSearchService(AppDbContext context, FindingVectorStore vectorStore)
    : ISemanticSearchService
{
    public async Task<List<SemanticSearchResult>> SearchFindingsAsync(
        string query, Guid? projectId, int top, CancellationToken cancellationToken = default)
    {
        if (top <= 0)
        {
            top = 20;
        }

        var hits = await vectorStore.SearchAsync(query, projectId, top, cancellationToken);
        if (hits.Count == 0)
        {
            return [];
        }

        // Preserve score order: map findingId -> score and its rank.
        var scoreById = new Dictionary<Guid, double>();
        var rankById = new Dictionary<Guid, int>();
        for (var i = 0; i < hits.Count; i++)
        {
            var (findingId, score) = hits[i];
            if (scoreById.ContainsKey(findingId))
            {
                continue;
            }
            scoreById[findingId] = score;
            rankById[findingId] = i;
        }

        var ids = scoreById.Keys.ToList();
        var findings = await context.Findings
            .Where(f => ids.Contains(f.Id))
            .Select(f => new
            {
                f.Id,
                f.Name,
                f.Location,
                f.Severity,
                f.Status,
                f.ProjectId
            })
            .ToListAsync(cancellationToken);

        return findings
            .Select(f => new SemanticSearchResult
            {
                Id = f.Id,
                Name = f.Name,
                Location = f.Location,
                Severity = f.Severity,
                Status = f.Status,
                ProjectId = f.ProjectId,
                Score = scoreById[f.Id]
            })
            .OrderBy(r => rankById[r.Id])
            .ToList();
    }
}
