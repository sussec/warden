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
    public static string ScanDockerSocket => Config.ScanDockerSocket;
    public static string ScanImagePrefix => Config.ScanImagePrefix;
    public static string ScanNetwork => Config.ScanNetwork;
    public static string ScanWardenUrl => Config.ScanWardenUrl;
    public static string ScanToken => Config.ScanToken;
    public static string ScanWorkspaceVolume => Config.ScanWorkspaceVolume;
    public static string ScanWorkspacePath => Config.ScanWorkspacePath;
    public static string ScanGitToken => Config.ScanGitToken;
    public static string OsvServiceUrl => Config.OsvServiceUrl;
    public static SecurityKey AccessTokenKey => Config.AccessTokenSecurityKey;
    public static SecurityKey RefreshTokenKey => Config.RefreshTokenSecurityKey;
}