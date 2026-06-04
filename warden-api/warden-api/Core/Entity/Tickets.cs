using Warden.Core.Enum;

namespace Warden.Core.Entity;

public class Tickets : BaseEntity
{
    public required string Name { get; set; }
    public required TicketType Type { get; set; }
    public required string Url { get; set; }
}