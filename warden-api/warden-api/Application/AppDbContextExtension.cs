using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Warden.Application;

public static class AppDbContextExtension
{
    public static IServiceCollection AddDbContext(this IServiceCollection services)
    {
        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseNpgsql(Configuration.DbConnectionString);
            // Allow lightweight DDL patches (e.g. GitLabSetting) without a full migration assembly.
            options.ConfigureWarnings(w =>
                w.Ignore(RelationalEventId.PendingModelChangesWarning));
        });
        var provider = services.BuildServiceProvider();
        var appDbContext = provider.GetRequiredService<AppDbContext>();
        appDbContext.Database.Migrate();
        return services;
    }
}