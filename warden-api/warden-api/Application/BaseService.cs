using Warden.Application.Exceptions;
using Warden.Authentication.Jwt;

namespace Warden.Application;

public abstract class BaseService(IHttpContextAccessor contextAccessor)
{
    private JwtUserClaims? userClaims;

    private JwtUserClaims User()
    {
        var principal = contextAccessor.HttpContext?.User;
        if (principal == null) throw new UnauthorizedException();
        return userClaims ??= principal.UserClaims();
    }
    protected JwtUserClaims CurrentUser => User();
}