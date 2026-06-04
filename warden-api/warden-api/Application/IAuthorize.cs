using Warden.Authentication.Jwt;

namespace Warden.Application;

public interface IAuthorize<in T>
{
    bool Authorize(T resource, JwtUserClaims user, string permission);
}

