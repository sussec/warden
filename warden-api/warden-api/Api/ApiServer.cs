using System.Net;
using System.Net.Sockets;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Warden.Application;
using Warden.Application.Module.Mcp;
using Warden.Application.Schedulers;
using Warden.Authentication;
using Warden.Core;
using Warden.Middleware;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using Scalar.AspNetCore;
using Serilog;
using IPNetwork = Microsoft.AspNetCore.HttpOverrides.IPNetwork;

namespace Warden.Api;

public static class ApiServer
{
    public static void Run(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost |
                                       ForwardedHeaders.XForwardedFor;
            options.AddTrustedProxies(Configuration.TrustedProxies);
        });
        builder.Host.UseSerilog((context, configuration) =>
            configuration.ReadFrom.Configuration(context.Configuration));
        // App DB Context
        builder.Services.AddDbContext();
        // Memory Cache
        builder.Services.AddMemoryCache();
        // App Module
        builder.Services.AddAppModules();
        // MCP server (Model Context Protocol)
        builder.Services.AddWardenMcp();
        // Authentication
        builder.Services.AddAppAuthentication();
        // Controller
        builder.Services.AddControllers(options =>
        {
            options.Conventions.Add(new RouteTokenTransformerConvention(new SlugifyParameterTransformer()));
        }).AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        });
        builder.Services.AddScheduleJobs();
        // Handler model state
        builder.Services.ConfigureInvalidModelState();
        builder.Services.AddHttpContextAccessor();
        // add init data service
        builder.Services.AddScoped<InitDataService>();
        //cors 
        builder.Services.AddCors();
        // swagger
        builder.Services.AddSwaggers();
        // config upload 
        builder.Services.Configure<FormOptions>(options =>
        {
            options.MultipartBodyLengthLimit = 26843545; // 25MB
        });
        builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();
        var app = builder.Build();
        app.MapHealthChecks("/healthz");
        app.InitApp();
        // Configure the HTTP request pipeline.
        // OpenAPI spec drives the typed client in warden-web (`bun run gen-api`).
        // Served in all environments unless OPENAPI_ENABLED=false.
        if (Configuration.OpenApiEnabled)
        {
            app.UseSwagger(options => { options.RouteTemplate = "/openapi/{documentName}.json"; });

            app.UseSwaggerUI(options => { options.SwaggerEndpoint("/openapi/v1.json", "API V1"); });
            app.MapScalarApiReference();
        }

        app.ConfigureExceptionHandler();
        // Backend-only API: the web app proxies same-origin requests; this allowlist
        // covers direct cross-origin access (FRONTEND_URL, comma-separated).
        var allowedOrigins = Configuration.FrontendUrl
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        app.UseCors(x =>
        {
            if (allowedOrigins.Length > 0)
                x.WithOrigins(allowedOrigins).AllowAnyMethod().AllowAnyHeader().AllowCredentials();
            else
                x.AllowAnyMethod().AllowAnyHeader().SetIsOriginAllowed(_ => true).AllowCredentials();
        });
        app.UseHttpsRedirection();
        app.UseRouting();
        app.UseForwardedHeaders();
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllers();
        app.MapWardenMcp();
        app.LoadAuthenticationProviders();
        app.Run();
    }

    private static void AddTrustedProxies(this ForwardedHeadersOptions options, string trustedProxies)
    {
        if (string.IsNullOrWhiteSpace(trustedProxies))
            return;
        var proxies = trustedProxies.Split(',', StringSplitOptions.RemoveEmptyEntries);

        foreach (var proxy in proxies)
        {
            var trimmedProxy = proxy.Trim();
            // Check if it's a CIDR block
            if (trimmedProxy.Contains('/'))
            {
                if (TryParseIpNetwork(trimmedProxy, out var network, out var prefixLength))
                {
                    options.KnownNetworks.Add(new IPNetwork(network, prefixLength));
                }
            }
            // Single IP address
            else if (IPAddress.TryParse(trimmedProxy, out var ipAddress))
            {
                options.KnownProxies.Add(ipAddress);
            }
        }
    }

    private static bool TryParseIpNetwork(string cidr, out IPAddress network, out int prefixLength)
    {
        network = IPAddress.None;
        prefixLength = 0;

        var parts = cidr.Split('/');
        if (parts.Length != 2)
            return false;

        if (!IPAddress.TryParse(parts[0], out network))
            return false;

        if (!int.TryParse(parts[1], out prefixLength))
            return false;

        // Validate prefix length based on address family
        var maxPrefixLength = network.AddressFamily == AddressFamily.InterNetwork ? 32 : 128;
        if (prefixLength < 0 || prefixLength > maxPrefixLength)
            return false;

        return true;
    }
}

internal sealed partial class SlugifyParameterTransformer : IOutboundParameterTransformer
{
    private readonly Regex myRegex = MyRegex();

    public string? TransformOutbound(object? value)
    {
        if (value == null) return null;

        var str = value.ToString();
        return string.IsNullOrEmpty(str) ? null : myRegex.Replace(str, "$1-$2").ToLower();
    }

    [GeneratedRegex("([a-z])([A-Z])")]
    private static partial Regex MyRegex();
}