using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Warden.Application;

/// <summary>
/// Used by the dotnet-ef tooling to create migrations without bootstrapping the full application host.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=warden;Username=warden;Password=warden")
            .Options;
        return new AppDbContext(options);
    }
}
