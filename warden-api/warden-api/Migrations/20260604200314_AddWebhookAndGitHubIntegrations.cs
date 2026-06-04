using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Warden.Migrations
{
    /// <inheritdoc />
    public partial class AddWebhookAndGitHubIntegrations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GitHubSetting",
                table: "ProjectSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WebhookSetting",
                table: "ProjectSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GitHubSetting",
                table: "AppSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WebhookSetting",
                table: "AppSettings",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GitHubSetting",
                table: "ProjectSettings");

            migrationBuilder.DropColumn(
                name: "WebhookSetting",
                table: "ProjectSettings");

            migrationBuilder.DropColumn(
                name: "GitHubSetting",
                table: "AppSettings");

            migrationBuilder.DropColumn(
                name: "WebhookSetting",
                table: "AppSettings");
        }
    }
}
