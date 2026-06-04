using Warden.Authentication.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Warden.Api;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
[Consumes("application/json")]
public abstract class BaseController : Controller
{
    protected JwtUserClaims CurrentUser => User.UserClaims();
}