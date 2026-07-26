using System.Text;
using System.Text.Json.Serialization;
using Warden.Authentication;
using Warden.Core.Utils;
using Microsoft.IdentityModel.Tokens;

namespace Warden.Application;

public class AppConfig
{
    // database
    [Option(Env = "DB_USERNAME", Default = "warden")]
    public string DbUsername { get; set; } = string.Empty;

    [Option(Env = "DB_PASSWORD", Default = "warden")]
    public string DbPassword { get; set; } = string.Empty;

    [Option(Env = "DB_NAME", Default = "warden")]
    public string DbName { get; set; } = string.Empty;

    [Option(Env = "DB_SERVER", Default = "localhost")]

    public string DbServer { get; set; } = string.Empty;

    // app config
    [Option(Env = "SYSTEM_PASSWORD", Default = "")]
    public string SystemPassword { get; set; } = string.Empty;

    [Option(Env = "ACCESS_TOKEN_KEY")] public string AccessTokenKey { get; set; } = string.Empty;

    [Option(Env = "REFRESH_TOKEN_KEY")] public string RefreshTokenKey { get; set; } = string.Empty;

    [Option(Env = "FRONTEND_URL", Default = "")]
    public string FrontendUrl { get; set; } = string.Empty;
    
    [Option(Env = "TRUSTED_PROXIES", Default = "")]
    public string TrustedProxies { get; set; } = string.Empty;

    [Option(Env = "OPENAPI_ENABLED", Default = "true")]
    public string OpenApiEnabled { get; set; } = string.Empty;

    // on-demand scan runner (UI-triggered): docker socket and/or Kubernetes Jobs
    [Option(Env = "SCAN_BACKEND", Default = "auto")]
    public string ScanBackend { get; set; } = "auto";

    [Option(Env = "SCAN_DOCKER_SOCKET", Default = "unix:///var/run/docker.sock")]
    public string ScanDockerSocket { get; set; } = string.Empty;

    [Option(Env = "SCAN_IMAGE_PREFIX", Default = "warden-")]
    public string ScanImagePrefix { get; set; } = string.Empty;

    [Option(Env = "SCAN_NETWORK", Default = "warden_default")]
    public string ScanNetwork { get; set; } = string.Empty;

    [Option(Env = "SCAN_WARDEN_URL", Default = "http://warden:8080")]
    public string ScanWardenUrl { get; set; } = string.Empty;

    [Option(Env = "WARDEN_TOKEN", Default = "")]
    public string ScanToken { get; set; } = string.Empty;

    // Shared volume into which the runner clones git-URL targets, mounted into
    // both this container and the scanner containers it launches.
    [Option(Env = "SCAN_WORKSPACE_VOLUME", Default = "warden_scan_workspace")]
    public string ScanWorkspaceVolume { get; set; } = string.Empty;

    [Option(Env = "SCAN_WORKSPACE_PATH", Default = "/scan-workspace")]
    public string ScanWorkspacePath { get; set; } = string.Empty;

    // Optional token for cloning private https git repos (x-access-token).
    [Option(Env = "SCAN_GIT_TOKEN", Default = "")]
    public string ScanGitToken { get; set; } = string.Empty;

    /// <summary>Namespace for scan Jobs (defaults to the API pod namespace / SCAN_NETWORK).</summary>
    [Option(Env = "SCAN_NAMESPACE", Default = "")]
    public string ScanNamespace { get; set; } = string.Empty;

    /// <summary>Optional imagePullSecret name for private scanner registries (Harbor).</summary>
    [Option(Env = "SCAN_IMAGE_PULL_SECRET", Default = "")]
    public string ScanImagePullSecret { get; set; } = string.Empty;

    /// <summary>Init-container image used to clone git targets for K8s Jobs.</summary>
    [Option(Env = "SCAN_GIT_IMAGE", Default = "alpine/git:2.47.2")]
    public string ScanGitImage { get; set; } = string.Empty;

    // warden-osv sidecar for OSV.dev advisory enrichment; empty disables.
    [Option(Env = "OSV_SERVICE_URL", Default = "")]
    public string OsvServiceUrl { get; set; } = string.Empty;

    [JsonIgnore] internal SecurityKey AccessTokenSecurityKey = null!;
    [JsonIgnore] internal SecurityKey RefreshTokenSecurityKey = null!;

    public static AppConfig Load()
    {
        var config = ConfigParser.Parse<AppConfig>();
        if (string.IsNullOrEmpty(config.AccessTokenKey))
        {
            config.AccessTokenKey = PasswordGenerator.GeneratePassword(32);
        }

        if (string.IsNullOrEmpty(config.RefreshTokenKey))
        {
            config.RefreshTokenKey = PasswordGenerator.GeneratePassword(32);
        }

        if (string.IsNullOrEmpty(config.SystemPassword))
        {
            config.SystemPassword = PasswordGenerator.GeneratePassword(32);
        }

        ConfigParser.Save(config);
        config.AccessTokenSecurityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.AccessTokenKey));
        config.RefreshTokenSecurityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.RefreshTokenKey));
        return config;
    }
}