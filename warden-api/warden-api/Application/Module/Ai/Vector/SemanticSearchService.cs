using Warden.Authentication;
using Warden.Authentication.Jwt;
using Warden.Core.Enum;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Ai.Vector;

public sealed class SemanticSearchService(AppDbContext context, FindingVectorStore vectorStore)
    : ISemanticSearchService
{
    public async Task<List<SemanticSearchResult>> SearchFindingsAsync(
        JwtUserClaims currentUser, string query, Guid? projectId, int top, CancellationToken cancellationToken = default)
    {
        if (top <= 0)
        {
            top = 20;
        }

        // Over-fetch from the vector store so that, after authorization filtering on the SQL
        // join below, we can still return up to `top` results the user is allowed to see.
        var hits = await vectorStore.SearchAsync(query, projectId, top * 4, cancellationToken);
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
        // Authorization: users without the global Finding.Read claim only see findings in
        // projects they belong to — mirrors FindingFilterQueryable so search cannot leak
        // finding names/locations across tenant boundaries.
        var canReadAllFinding = currentUser.HasClaim(PermissionType.Finding, PermissionAction.Read);
        var findings = await context.Findings
            .Where(f => ids.Contains(f.Id))
            .Where(f => canReadAllFinding || context.ProjectUsers.Any(projectUser =>
                projectUser.ProjectId == f.ProjectId && projectUser.UserId == currentUser.Id))
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
            .Take(top)
            .ToList();
    }
}
