using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Ai.Vector;

/// <summary>
/// Populates the finding_embeddings collection for all existing findings. Intended for initial
/// population / re-indexing. Returns the number of findings processed.
/// </summary>
public sealed class FindingEmbeddingBackfillService(
    AppDbContext context,
    FindingVectorStore vectorStore,
    ILogger<FindingEmbeddingBackfillService> logger)
{
    public async Task<int> BackfillAsync(int batchSize = 200, CancellationToken cancellationToken = default)
    {
        if (batchSize <= 0)
        {
            batchSize = 200;
        }

        var processed = 0;
        var skip = 0;

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var batch = await context.Findings
                .AsNoTracking()
                .OrderBy(f => f.Id)
                .Skip(skip)
                .Take(batchSize)
                .ToListAsync(cancellationToken);

            if (batch.Count == 0)
            {
                break;
            }

            foreach (var finding in batch)
            {
                await vectorStore.UpsertFindingAsync(finding, cancellationToken);
                processed++;
            }

            logger.LogInformation("Backfilled embeddings for {Processed} findings so far", processed);
            skip += batchSize;
        }

        return processed;
    }
}
