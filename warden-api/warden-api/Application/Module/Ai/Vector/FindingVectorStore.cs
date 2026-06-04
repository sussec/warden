using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.VectorData;
using Microsoft.SemanticKernel.Connectors.PgVector;
using Npgsql;
using Pgvector;
using Warden.Application.Module.Ai;
using Warden.Core.Entity;

namespace Warden.Application.Module.Ai.Vector;

/// <summary>
/// A finding embedding record stored in the pgvector-backed "finding_embeddings" collection.
/// The vector dimension is declared as 1536 (OpenAI text-embedding-3-small default); pgvector
/// itself stores the value as a flexible vector column, so other embedding sizes also work as
/// long as the configured embedding model is used consistently.
/// </summary>
public sealed record FindingEmbedding
{
    [VectorStoreKey]
    public Guid Id { get; init; }

    [VectorStoreData(IsIndexed = true)]
    public Guid ProjectId { get; init; }

    [VectorStoreData]
    public string Text { get; init; } = string.Empty;

    [VectorStoreVector(1536, DistanceFunction = DistanceFunction.CosineSimilarity)]
    public ReadOnlyMemory<float> Embedding { get; init; }
}

/// <summary>
/// Manages the pgvector-backed collection of finding embeddings. All methods are no-ops returning
/// empty results when AI/embeddings are disabled (the embedding generator is null), or when the
/// pgvector extension is not available in the database.
/// </summary>
public sealed class FindingVectorStore(
    IAiClientFactory aiClientFactory,
    ILogger<FindingVectorStore> logger)
{
    private const string CollectionName = "finding_embeddings";
    private const int MaxInputChars = 8000;

    private const string PgVectorMissingWarning =
        "pgvector extension not available - semantic search disabled; " +
        "use the pgvector/pgvector:pg18 image (or run 'CREATE EXTENSION vector;' in PostgreSQL).";

    private static NpgsqlDataSource? _dataSource;
    private static readonly object DataSourceLock = new();

    private static NpgsqlDataSource GetDataSource()
    {
        if (_dataSource != null)
        {
            return _dataSource;
        }
        lock (DataSourceLock)
        {
            if (_dataSource == null)
            {
                var builder = new NpgsqlDataSourceBuilder(Configuration.DbConnectionString);
                builder.UseVector();
                _dataSource = builder.Build();
            }
        }
        return _dataSource;
    }

    private static VectorStoreCollection<Guid, FindingEmbedding> CreateCollection()
    {
        // ctor: (NpgsqlDataSource dataSource, bool ownsDataSource, PostgresVectorStoreOptions? options)
        // ownsDataSource = false: the static data source is shared/reused, so the store must not dispose it.
        var store = new PostgresVectorStore(GetDataSource(), false);
        return store.GetCollection<Guid, FindingEmbedding>(CollectionName);
    }

    /// <summary>
    /// Builds the embedding input text for a finding, truncated to keep request size reasonable.
    /// </summary>
    private static string BuildInputText(Findings finding)
    {
        var text = $"{finding.Name}\n{finding.Category}\n{finding.RuleId}\n{finding.Description}\n{finding.Snippet}";
        return text.Length > MaxInputChars ? text[..MaxInputChars] : text;
    }

    /// <summary>
    /// Upserts (creates or replaces) the embedding for a single finding. No-op when AI is disabled
    /// or pgvector is unavailable.
    /// </summary>
    public async Task UpsertFindingAsync(Findings finding, CancellationToken cancellationToken = default)
    {
        var generator = await aiClientFactory.CreateEmbeddingGeneratorAsync();
        if (generator == null)
        {
            return;
        }

        try
        {
            var collection = CreateCollection();
            await collection.EnsureCollectionExistsAsync(cancellationToken);

            var input = BuildInputText(finding);
            var embedding = await generator.GenerateAsync(input, cancellationToken: cancellationToken);

            await collection.UpsertAsync(new FindingEmbedding
            {
                Id = finding.Id,
                ProjectId = finding.ProjectId,
                Text = input,
                Embedding = embedding.Vector
            }, cancellationToken);
        }
        catch (Exception e) when (IsPgVectorMissing(e))
        {
            logger.LogWarning(e, PgVectorMissingWarning);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to upsert finding embedding for {FindingId}", finding.Id);
        }
    }

    /// <summary>
    /// Searches the embedding collection for findings semantically similar to <paramref name="query"/>.
    /// Returns an ordered list of (FindingId, Score), highest score first. Empty when AI is disabled
    /// or pgvector is unavailable.
    /// </summary>
    public async Task<List<(Guid FindingId, double Score)>> SearchAsync(
        string query, Guid? projectId, int top = 20, CancellationToken cancellationToken = default)
    {
        var results = new List<(Guid, double)>();
        if (string.IsNullOrWhiteSpace(query))
        {
            return results;
        }

        var generator = await aiClientFactory.CreateEmbeddingGeneratorAsync();
        if (generator == null)
        {
            return results;
        }

        try
        {
            var collection = CreateCollection();
            await collection.EnsureCollectionExistsAsync(cancellationToken);

            var queryEmbedding = await generator.GenerateAsync(query, cancellationToken: cancellationToken);

            var options = new VectorSearchOptions<FindingEmbedding>();
            if (projectId.HasValue)
            {
                var pid = projectId.Value;
                options.Filter = record => record.ProjectId == pid;
            }

            await foreach (var result in collection.SearchAsync(queryEmbedding.Vector, top, options, cancellationToken))
            {
                results.Add((result.Record.Id, result.Score ?? 0));
            }
        }
        catch (Exception e) when (IsPgVectorMissing(e))
        {
            logger.LogWarning(e, PgVectorMissingWarning);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Semantic search failed for query");
        }

        return results;
    }

    /// <summary>
    /// Deletes a finding's embedding. No-op when AI is disabled or pgvector is unavailable.
    /// </summary>
    public async Task DeleteAsync(Guid findingId, CancellationToken cancellationToken = default)
    {
        var generator = await aiClientFactory.CreateEmbeddingGeneratorAsync();
        if (generator == null)
        {
            return;
        }

        try
        {
            var collection = CreateCollection();
            await collection.EnsureCollectionExistsAsync(cancellationToken);
            await collection.DeleteAsync(findingId, cancellationToken);
        }
        catch (Exception e) when (IsPgVectorMissing(e))
        {
            logger.LogWarning(e, PgVectorMissingWarning);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to delete finding embedding for {FindingId}", findingId);
        }
    }

    private static bool IsPgVectorMissing(Exception e)
    {
        // Npgsql surfaces a PostgresException (SqlState 42704 "undefined_object" / 0A000) or a message
        // referencing the missing "vector" type/extension when pgvector is not installed.
        for (var current = e; current != null; current = current.InnerException)
        {
            if (current is PostgresException pg &&
                (pg.SqlState == "42704" || pg.SqlState == "0A000" || pg.SqlState == "3F000"))
            {
                return true;
            }

            var message = current.Message;
            if (message.Contains("extension \"vector\"", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("type \"vector\"", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("pgvector", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
