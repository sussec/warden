using Microsoft.IdentityModel.Tokens;

namespace Warden.Application;

public static class Configuration
{
    private static readonly AppConfig Config = AppConfig.Load();
    public const string AppName = "Warden";
    public static string FrontendUrl => Config.FrontendUrl;
    public static string TrustedProxies => Config.TrustedProxies;

    public static bool OpenApiEnabled =>
        !string.Equals(Config.OpenApiEnabled, "false", StringComparison.OrdinalIgnoreCase);

    public static string DbConnectionString =>
        $"Host={Config.DbServer};Database={Config.DbName};Username={Config.DbUsername};Password={Config.DbPassword}";
    
    public static string SystemPassword => Config.SystemPassword;
    public static SecurityKey AccessTokenKey => Config.AccessTokenSecurityKey;
    public static SecurityKey RefreshTokenKey => Config.RefreshTokenSecurityKey;
}