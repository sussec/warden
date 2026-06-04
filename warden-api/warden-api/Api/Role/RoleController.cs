using Warden.Application.Module.Role;
using Warden.Application.Module.Role.Model;
using Warden.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api.Role;

public class RoleController(IRoleService roleService) : BaseController
{
    [HttpGet]
    [Permission(PermissionType.Role, PermissionAction.Read)]
    public async Task<List<RoleSummary>> GetRoles()
    {
        return await roleService.ListRoleAsync();
    }
}