using System.Text.Json.Serialization;

namespace Warden.Core.Enum;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum CommitType
{
    CommitBranch,
    CommitTag,
    MergeRequest,
}