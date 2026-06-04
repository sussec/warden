using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Warden.Migrations
{
    /// <inheritdoc />
    public partial class EnablePgvectorExtension : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Enable pgvector for semantic search. Tolerant of databases where the
            // extension is unavailable (stock postgres image) — semantic search then
            // degrades to a no-op instead of breaking startup.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    CREATE EXTENSION IF NOT EXISTS vector;
                EXCEPTION WHEN OTHERS THEN
                    RAISE NOTICE 'pgvector extension unavailable - semantic search disabled';
                END
                $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP EXTENSION IF EXISTS vector CASCADE;");
        }
    }
}
