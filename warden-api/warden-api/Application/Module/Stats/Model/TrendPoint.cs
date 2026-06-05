namespace Warden.Application.Module.Stats.Model;

public record TrendPoint
{
    public required DateTime Date { get; init; }
    public required int Critical { get; init; }
    public required int High { get; init; }
    public required int Medium { get; init; }
    public required int Low { get; init; }
}
