using Aguacongas.AspNetCore.Authentication.EntityFramework;

namespace Warden.Core.Entity;

public class AuthProviders: SchemeDefinition
{
    public bool Enable { get; set; }
}