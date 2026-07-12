using Warden.Application.Exceptions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Warden.Middleware;

internal record Error(int Status, IEnumerable<string> Errors);

/// <summary>
/// Central exception handling. Domain exceptions (<see cref="WebException"/>,
/// e.g. 400/401/403/404) are expected control-flow: they are written to the
/// response and logged at Warning without a stack trace. Only genuinely
/// unexpected exceptions are logged at Error and surfaced as 500.
/// </summary>
public class ExceptionHandlerMiddleware(RequestDelegate next, ILogger<ExceptionHandlerMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (WebException domain)
        {
            logger.LogWarning("{Method} {Path} -> {Status}: {Errors}",
                context.Request.Method, context.Request.Path, domain.Status,
                string.Join("; ", domain.Errors));
            await Write(context, domain.Status, domain.Errors);
        }
        catch (NotImplementedException)
        {
            logger.LogWarning("{Method} {Path} -> 501 Not Implemented",
                context.Request.Method, context.Request.Path);
            await Write(context, StatusCodes.Status501NotImplemented, ["Not Implemented"]);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception on {Method} {Path}",
                context.Request.Method, context.Request.Path);
            await Write(context, 500, [ex.Message]);
        }
    }

    private static async Task Write(HttpContext context, int status, IEnumerable<string> errors)
    {
        if (context.Response.HasStarted) return;
        context.Response.Clear();
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new Error(status, errors));
    }
}

public static class ExceptionHandler
{
    public static IApplicationBuilder ConfigureExceptionHandler(this IApplicationBuilder app)
        => app.UseMiddleware<ExceptionHandlerMiddleware>();
}
