using Warden.Application.Module.User.Model;
using Warden.Core.Entity;
using Warden.Core.EntityFramework;
using Warden.Core.Enum;
using FluentResults;

namespace Warden.Application.Module.User.Command;

public class GetUserSummaryByFilterCommand(AppDbContext context)
{
    public async Task<Result<Page<UserSummary>>> ExecuteAsync(UserFilter filter)
    {
        var query = context.Users.Where(user => user.Status != UserStatus.Disabled && user.IsDefault == false);
        if (!string.IsNullOrEmpty(filter.Name)) query = query.Where(user => user.UserName!.Contains(filter.Name));

        if (filter.RoleId != null)
            query = query.Where(user =>
                context.UserRoles.Any(userRole => userRole.UserId == user.Id && userRole.RoleId == filter.RoleId));

        return await query.OrderBy(nameof(Users.CreatedAt), filter.Desc).Select(user => new UserSummary
        {
            Id = user.Id,
            UserName = user.UserName!,
            FullName = user.FullName,
            Avatar = user.Avatar,
            Email = user.Email
        }).PageAsync(filter.Page, filter.Size);
    }
}