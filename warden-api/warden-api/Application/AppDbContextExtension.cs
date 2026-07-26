using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Warden.Application;

public static class AppDbContextExtension
{
    public static IServiceCollection AddDbContext(this IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseNpgsql(Configuration.DbConnectionString, npgsql =>
            {
                // Transient network blips under load
                npgsql.EnableRetryOnFailure(
                    maxRetryCount: 3,
                    maxRetryDelay: TimeSpan.FromSeconds(2),
                    errorCodesToAdd: null);
                npgsql.CommandTimeout(60);
            });
            // Keep default tracking for Identity / SaveChanges correctness.
            // Hot read paths use .AsNoTracking() explicitly.
            options.ConfigureWarnings(w =>
                w.Ignore(RelationalEventId.PendingModelChangesWarning));
        });

        // Eager migrate + performance indexes on boot
        using var scope = services.BuildServiceProvider().CreateScope();
        var appDbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        appDbContext.Database.Migrate();
        PerformanceIndexBootstrap.EnsureAsync(appDbContext).GetAwaiter().GetResult();
        return services;
    }
}
