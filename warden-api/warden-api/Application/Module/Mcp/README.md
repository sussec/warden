# Warden MCP Server

This module exposes Warden's ASPM data and a small set of mutations to
[Model Context Protocol](https://modelcontextprotocol.io) (MCP) clients such as
Claude Desktop, so an LLM can query findings, inspect project posture, update a
finding's status, and surface SLA breaches.

It is built on the official C# SDK (`ModelContextProtocol.AspNetCore` 1.3.0) using
the streamable-HTTP transport, and is mounted at `/mcp`.

## Wiring (already done by the orchestrator)

`ApiServer.cs` only needs two lines:

```csharp
// in the service-registration section
builder.Services.AddWardenMcp();

// after app.UseAuthentication() / app.UseAuthorization()
app.MapWardenMcp();
```

- `AddWardenMcp()` registers the MCP server (`ServerInfo.Name = "warden"`,
  version from the assembly), the HTTP transport, and the `WardenMcpTools` tool
  type.
- `MapWardenMcp()` maps the endpoints at `/mcp` and calls `RequireAuthorization()`,
  so the existing JWT bearer scheme protects the server.

## Connecting

- **URL:** `http(s)://<host>/mcp`
- **Auth:** send a Warden JWT in the `Authorization` header:
  `Authorization: Bearer <token>`

### Claude Desktop / `mcp.json` snippet

The streamable-HTTP transport is reached directly by HTTP-capable clients. For
clients that only speak stdio, bridge with `mcp-remote`:

```json
{
  "mcpServers": {
    "warden": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-warden-host/mcp",
        "--header",
        "Authorization: Bearer ${WARDEN_TOKEN}"
      ],
      "env": {
        "WARDEN_TOKEN": "<your-jwt-here>"
      }
    }
  }
}
```

For native HTTP MCP clients, configure the server URL `https://your-warden-host/mcp`
and add the `Authorization: Bearer <token>` header.

## Tools

| Tool | Description | Parameters |
| --- | --- | --- |
| `query_findings` | List findings as JSON (`id, name, severity, status, project, location, createdAt`). | `projectName?`, `severity?`, `status?`, `limit=20` |
| `get_project_posture` | Finding counts by severity and status for a project, plus last scan time. | `projectName` |
| `update_finding_status` | Set a finding's `Status` and append a `ChangeStatus` activity (optional comment). | `findingId`, `status`, `comment?` |
| `list_sla_breaches` | Open/Confirmed findings whose `FixDeadline` is in the past, with `daysOverdue`. | `limit=20` |

### Enum values

- **Severity:** `Info`, `Low`, `Medium`, `High`, `Critical`
- **Status:** `Open`, `Confirmed`, `AcceptedRisk`, `Fixed`, `Incorrect`

`severity` and `status` filters are parsed case-insensitively by enum name.

## Notes

- All tool results are JSON strings serialized with `System.Text.Json` using
  camelCase property names.
- Tool methods take `AppDbContext` as a parameter; the SDK resolves it from the
  per-request `IServiceProvider`, giving each invocation a scoped DbContext.
- `update_finding_status` records the activity with a null `UserId` (system actor),
  since the MCP transport is not bound to an interactive user. When the new status
  is `Fixed`, the finding's `FixedAt` is stamped. `CreatedAt`/`UpdatedAt` are set
  automatically by `AppDbContext.SaveChangesAsync`.
