using Warden.Application.Module.Finding.Model;
using Warden.Authentication.Jwt;
using Warden.Core.EntityFramework;
using FluentResults;
using Microsoft.EntityFrameworkCore;

namespace Warden.Application.Module.Finding.Command;

public class GetFindingByFilterCommand(AppDbContext context, JwtUserClaims currentUser)
{
    public async Task<Result<Page<FindingSummary>>> ExecuteAsync(FindingFilter filter)
    {
        // No Include + Distinct: Select projects join; Distinct was O(n) over huge sets.
        // AsNoTracking is default on the context; explicit for clarity.
        return await context.Findings
            .AsNoTracking()
            .FindingFilter(context, currentUser, filter)
            .OrderBy(filter.SortBy.ToString(), filter.Desc)
            .Select(finding => new FindingSummary
            {
                Id = finding.Id,
                Identity = finding.Identity,
                Name = finding.Name,
                Status = finding.Status,
                Severity = finding.Severity,
                Scanner = finding.Scanner!.Name,
                Type = finding.Scanner.Type
            })
            .PageAsync(filter.Page, filter.Size);
    }
}