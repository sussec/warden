using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Warden.Core;

namespace Warden.Application.Caching;

public class CachingModule : IModule
{
    public IServiceCollection RegisterModule(IServiceCollection builder)
    {
        // Sized L1 memory cache (entries need Size=1 when SizeLimit set)
        builder.AddMemoryCache(o =>
        {
            o.SizeLimit = 10_000;
            o.CompactionPercentage = 0.25;
        });

        if (Configuration.RedisEnabled)
        {
            builder.AddStackExchangeRedisCache(o =>
            {
                o.Configuration = Configuration.RedisConnection;
                o.InstanceName = "warden:";
            });
            builder.AddSingleton<IAppCache>(sp =>
                new AppCache(
                    sp.GetRequiredService<IMemoryCache>(),
                    sp.GetRequiredService<IDistributedCache>()));
        }
        else
        {
            builder.AddSingleton<IAppCache>(sp =>
                new AppCache(sp.GetRequiredService<IMemoryCache>(), distributed: null));
        }

        return builder;
    }
}
