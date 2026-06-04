# Vector / Semantic-Search Module — Wiring Notes

This module was built strictly within the allowed folders:

- `warden-api/warden-api/Application/Module/Ai/Vector/`
- `warden-api/warden-api/Api/Ai/`

The items below are OUTSIDE that boundary and must be done by the orchestrator / a follow-up
change for the feature to be fully functional in production.

## 1. pgvector-capable Postgres image (docker-compose.yml — NOT edited)

The connector requires the PostgreSQL `vector` extension. The stock `postgres:*` image does NOT
ship it. Change the database service image in `docker-compose.yml` to a pgvector-enabled image:

```yaml
    image: pgvector/pgvector:pg18
```

(or run `CREATE EXTENSION IF NOT EXISTS vector;` against the existing database). The connector calls
`EnsureCollectionExistsAsync`, which issues `CREATE EXTENSION vector` / `CREATE TABLE`. If the
extension is unavailable the store logs a clear warning and degrades to a no-op (semantic search
returns empty, upserts/deletes are skipped) — it does NOT crash the app.

## 2. `Pgvector` NuGet package may need to become a DIRECT PackageReference (warden-api.csproj — NOT edited)

`FindingVectorStore.cs` uses:
- `Pgvector.NpgsqlDataSourceBuilderExtensions.UseVector()` (extension on `NpgsqlDataSourceBuilder`)
- `using Pgvector;`

`Pgvector` (v0.3.2) is currently only a **transitive** dependency of
`Microsoft.SemanticKernel.Connectors.PgVector` (1.74.0-preview). Transitive references normally
compile fine, but if the build complains that `UseVector` / namespace `Pgvector` cannot be found,
add a direct reference:

```xml
<PackageReference Include="Pgvector" Version="0.3.2" />
```

The connector also pins `Npgsql` 8.0.7; the project uses Npgsql 10. This is expected to resolve to
the higher version (10) via normal NuGet unification — verify no downgrade warning at build.

## 3. Hooking `UpsertFindingAsync` into the finding ingestion flow (existing files — NOT edited)

Embeddings are NOT automatically kept in sync. Findings are persisted via:

- **`AppDbContext.CreateFindingAsync(Findings finding)`** in
  `warden-api/warden-api/Application/Module/Finding/FindingExtension.cs`
  (this is the single insert point — sets `finding.Id`, adds to `context.Findings`, saves).

  This is called from the CI finding upload path:
  **`PushCiFindingCommand`** in
  `warden-api/warden-api/Application/Module/Ci/Command/PushCiFindingCommand.cs`
  (around line 133, building "new branch findings").

Recommended wiring (requires editing one of those out-of-boundary files, or refactoring
`CreateFindingAsync` to publish a domain event):

- After a finding is successfully created in `CreateFindingAsync`, resolve `FindingVectorStore`
  and call `await vectorStore.UpsertFindingAsync(finding)`. Because the store is a no-op when AI is
  disabled, it is safe to call unconditionally. Consider doing this fire-and-forget / out-of-band so
  embedding generation latency does not slow CI ingestion.
- Similarly, call `FindingVectorStore.DeleteAsync(findingId)` wherever findings are deleted, and
  re-`UpsertFindingAsync` when a finding's `Name/Description/Snippet/Category/RuleId` changes.

Until that hook is added, run the one-time/admin backfill endpoint to populate the index:

- `POST /api/ai/semantic-search/backfill` (permission `config:update`) →
  `FindingEmbeddingBackfillService.BackfillAsync()`.

## 4. Nothing else required

- DI registration is automatic: `VectorModule : IModule` is reflection-discovered by
  `ModuleExtensions.AddAppModules()` — no central registration needed.
- The controller is auto-routed by ASP.NET; routes are explicit (`api/ai/semantic-search`).
- Connection string is reused from `Warden.Application.Configuration.DbConnectionString`.
