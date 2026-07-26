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

    /// <summary>
    /// Tuned for high concurrency: large pool, prepared statements, short connect timeout.
    /// </summary>
    public static string DbConnectionString
    {
        get
        {
            var maxPool = int.TryParse(Config.DbMaxPoolSize, out var mx) ? Math.Clamp(mx, 10, 500) : 100;
            var minPool = int.TryParse(Config.DbMinPoolSize, out var mn) ? Math.Clamp(mn, 0, maxPool) : 5;
            return
                $"Host={Config.DbServer};Database={Config.DbName};Username={Config.DbUsername};Password={Config.DbPassword};" +
                $"Maximum Pool Size={maxPool};Minimum Pool Size={minPool};" +
                "Timeout=15;Command Timeout=60;" +
                "Max Auto Prepare=100;Auto Prepare Min Usages=2;" +
                "No Reset On Close=true;Enlist=false;Multiplexing=false;" +
                "Keepalive=30;Tcp Keepalive=true";
        }
    }

    public static string RedisConnection => Config.RedisConnection?.Trim() ?? string.Empty;
    public static bool RedisEnabled => !string.IsNullOrWhiteSpace(RedisConnection);

    public static string SystemPassword => Config.SystemPassword;
    public static string ScanBackend => Config.ScanBackend;
    public static string ScanDockerSocket => Config.ScanDockerSocket;
    public static string ScanImagePrefix => Config.ScanImagePrefix;
    public static string ScanNetwork => Config.ScanNetwork;
    public static string ScanWardenUrl => Config.ScanWardenUrl;
    public static string ScanToken => Config.ScanToken;
    public static string ScanWorkspaceVolume => Config.ScanWorkspaceVolume;
    public static string ScanWorkspacePath => Config.ScanWorkspacePath;
    public static string ScanGitToken => Config.ScanGitToken;
    public static string ScanNamespace =>
        string.IsNullOrWhiteSpace(Config.ScanNamespace) ? Config.ScanNetwork : Config.ScanNamespace;
    public static string ScanImagePullSecret => Config.ScanImagePullSecret;
    public static string ScanGitImage => Config.ScanGitImage;
    public static string OsvServiceUrl => Config.OsvServiceUrl;
    public static SecurityKey AccessTokenKey => Config.AccessTokenSecurityKey;
    public static SecurityKey RefreshTokenKey => Config.RefreshTokenSecurityKey;
}