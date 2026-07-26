using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading.Channels;
using Warden.Application.Module.Scan.Model;
using Warden.Core.Enum;

namespace Warden.Application.Module.Scan;

/// <summary>
/// In-process pub/sub for live scan-job events (status + log chunks).
/// Backend-agnostic: Docker runner and future K8s executor both publish here.
/// </summary>
public interface IScanJobStreamHub
{
    void Publish(ScanJobStreamEvent evt);
    IAsyncEnumerable<ScanJobStreamEvent> Subscribe(CancellationToken cancellationToken);
}

public sealed class ScanJobStreamHub : IScanJobStreamHub
{
    private readonly ConcurrentDictionary<Guid, Channel<ScanJobStreamEvent>> _subscribers = new();

    public void Publish(ScanJobStreamEvent evt)
    {
        foreach (var channel in _subscribers.Values)
            channel.Writer.TryWrite(evt);
    }

    public async IAsyncEnumerable<ScanJobStreamEvent> Subscribe(
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<ScanJobStreamEvent>(new BoundedChannelOptions(256)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        });
        _subscribers[id] = channel;
        try
        {
            await foreach (var evt in channel.Reader.ReadAllAsync(cancellationToken))
                yield return evt;
        }
        finally
        {
            _subscribers.TryRemove(id, out _);
        }
    }
}

public sealed record ScanJobStreamEvent(
    string Type, // job.queued | job.running | job.log | job.completed | job.failed | hello
    Guid? JobId,
    string? Scanner,
    string? Status,
    string? Target,
    string? Line,
    string? Log,
    DateTimeOffset At
)
{
    public static ScanJobStreamEvent Hello() =>
        new("hello", null, null, null, null, null, null, DateTimeOffset.UtcNow);

    public static ScanJobStreamEvent FromJob(ScanJobInfo job, string type) =>
        new(type, job.Id, job.Scanner, job.Status.ToString(), job.Target, null, job.Log, DateTimeOffset.UtcNow);

    public static ScanJobStreamEvent FromStatus(Guid jobId, string scanner, ScanJobStatus status, string? target = null) =>
        new(status switch
        {
            ScanJobStatus.Queued => "job.queued",
            ScanJobStatus.Running => "job.running",
            ScanJobStatus.Succeeded => "job.completed",
            ScanJobStatus.Failed => "job.failed",
            _ => "job.status"
        }, jobId, scanner, status.ToString(), target, null, null, DateTimeOffset.UtcNow);

    public static ScanJobStreamEvent LogLine(Guid jobId, string scanner, string line) =>
        new("job.log", jobId, scanner, ScanJobStatus.Running.ToString(), null, line, null, DateTimeOffset.UtcNow);
}
