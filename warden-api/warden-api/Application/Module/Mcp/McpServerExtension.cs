using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace Warden.Application.Module.Mcp;

/// <summary>
/// Wires the Warden MCP (Model Context Protocol) server into the host. The
/// orchestrator only needs two lines in ApiServer.cs:
/// <code>
/// builder.Services.AddWardenMcp();   // in the service-registration section
/// app.MapWardenMcp();                // after UseAuthentication/UseAuthorization
/// </code>
/// </summary>
public static class McpServerExtension
{
    /// <summary>
    /// Registers the MCP server with the streamable-HTTP transport and the
    /// Warden tool type. Server identity is "warden" with the version taken from
    /// the executing assembly.
    /// </summary>
    public static IServiceCollection AddWardenMcp(this IServiceCollection services)
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0";

        services
            .AddMcpServer(options =>
            {
                options.ServerInfo = new ModelContextProtocol.Protocol.Implementation
                {
                    Name = "warden",
                    Version = version
                };
            })
            .WithHttpTransport()
            .WithTools(typeof(WardenMcpTools));

        return services;
    }

    /// <summary>
    /// Maps the MCP endpoints at <c>/mcp</c> and requires authorization so the
    /// existing JWT bearer scheme protects the server.
    /// </summary>
    public static void MapWardenMcp(this WebApplication app)
    {
        app.MapMcp("/mcp").RequireAuthorization();
    }
}
