using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Warden.Application.Module.Scan;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;

namespace Warden.Api.Scan;

/// <summary>
/// Live scan-job event stream for the UI.
/// WebSocket: /ws/scan-jobs  (preferred)
/// SSE:       GET /api/scan-job/stream  (works through Next.js HTTP rewrites)
/// Both share <see cref="IScanJobStreamHub"/> — backend-agnostic (Docker / future K8s).
/// </summary>
public static class ScanJobStreamEndpoint
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static void MapScanJobStreams(this WebApplication app)
    {
        // SSE — same-origin via Next /api rewrite
        app.MapGet("/api/scan-job/stream", [Authorize] async (
            HttpContext http,
            IScanJobStreamHub hub,
            CancellationToken ct) =>
        {
            http.Response.Headers.ContentType = "text/event-stream";
            http.Response.Headers.CacheControl = "no-cache";
            http.Response.Headers.Connection = "keep-alive";
            await http.Response.Body.FlushAsync(ct);

            await WriteSse(http, hub, ct);
        });

        // WebSocket — prefer when reverse-proxy upgrades connections
        app.Map("/ws/scan-jobs", async (HttpContext http, IScanJobStreamHub hub) =>
        {
            if (!http.WebSockets.IsWebSocketRequest)
            {
                http.Response.StatusCode = StatusCodes.Status400BadRequest;
                await http.Response.WriteAsync("Expected WebSocket upgrade");
                return;
            }

            // Ensure JWT cookie / query token is evaluated for the upgrade request
            var auth = await http.AuthenticateAsync(
                Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme);
            if (!auth.Succeeded || auth.Principal?.Identity?.IsAuthenticated != true)
            {
                http.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }
            http.User = auth.Principal;

            using var socket = await http.WebSockets.AcceptWebSocketAsync();
            var ct = http.RequestAborted;
            await SendWs(socket, ScanJobStreamEvent.Hello(), ct);

            try
            {
                await foreach (var evt in hub.Subscribe(ct))
                {
                    if (socket.State != WebSocketState.Open) break;
                    await SendWs(socket, evt, ct);
                }
            }
            catch (OperationCanceledException)
            {
                // client gone
            }
        }).AllowAnonymous(); // auth handled inside (cookie / query token)
    }

    private static async Task WriteSse(HttpContext http, IScanJobStreamHub hub, CancellationToken ct)
    {
        async Task Emit(ScanJobStreamEvent evt)
        {
            var json = JsonSerializer.Serialize(evt, JsonOpts);
            await http.Response.WriteAsync($"event: {evt.Type}\n", ct);
            await http.Response.WriteAsync($"data: {json}\n\n", ct);
            await http.Response.Body.FlushAsync(ct);
        }

        await Emit(ScanJobStreamEvent.Hello());
        await foreach (var evt in hub.Subscribe(ct))
            await Emit(evt);
    }

    private static async Task SendWs(WebSocket socket, ScanJobStreamEvent evt, CancellationToken ct)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(evt, JsonOpts));
        await socket.SendAsync(bytes, WebSocketMessageType.Text, true, ct);
    }
}
