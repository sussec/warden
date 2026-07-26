using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;

namespace Warden.Application.Caching;

/// <summary>
/// Hybrid cache: L1 memory (always) + optional L2 Redis for multi-replica APIs.
/// </summary>
public interface IAppCache
{
    Task<T?> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan ttl,
        CancellationToken cancellationToken = default);

    void Remove(string key);
}

public sealed class AppCache(
    IMemoryCache memory,
    IDistributedCache? distributed = null
) : IAppCache
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<T?> GetOrCreateAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan ttl,
        CancellationToken cancellationToken = default)
    {
        if (memory.TryGetValue(key, out T? hit) && hit is not null)
            return hit;

        if (distributed != null)
        {
            try
            {
                var bytes = await distributed.GetAsync(key, cancellationToken);
                if (bytes is { Length: > 0 })
                {
                    var fromRedis = JsonSerializer.Deserialize<T>(bytes, JsonOpts);
                    if (fromRedis is not null)
                    {
                        memory.Set(key, fromRedis, ttl);
                        return fromRedis;
                    }
                }
            }
            catch
            {
                /* Redis blip — fall through to factory */
            }
        }

        var value = await factory(cancellationToken);
        if (value is null) return value;

        memory.Set(key, value, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = ttl,
            Size = 1
        });

        if (distributed != null)
        {
            try
            {
                var payload = JsonSerializer.SerializeToUtf8Bytes(value, JsonOpts);
                await distributed.SetAsync(
                    key,
                    payload,
                    new DistributedCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = ttl
                    },
                    cancellationToken);
            }
            catch
            {
                /* non-fatal */
            }
        }

        return value;
    }

    public void Remove(string key)
    {
        memory.Remove(key);
        if (distributed == null) return;
        try
        {
            distributed.Remove(key);
        }
        catch
        {
            /* ignore */
        }
    }
}

public static class CacheKeys
{
    public static string TicketTrackers() => "warden:ticket-trackers";
    public static string Scanners() => "warden:scanners:all";
    public static string Dashboard(string kind, string filterHash, string userId) =>
        $"warden:dash:{kind}:{userId}:{filterHash}";
    public static string SystemStatus() => "warden:system-status";
    public static string ScanCapability() => "warden:scan-capability";
}
