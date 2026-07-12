namespace Warden.Application.Helpers;

/// <summary>
/// Canonical frontend (warden-web / Next.js) URLs. Paths are absolute path
/// segments — no hash routing. Keep in sync with warden-web App Router routes.
/// </summary>
public static class FrontendUrlHelper
{
    public static string ProjectUrl(Guid projectId)
        => $"{Configuration.FrontendUrl}/project/{projectId}/overview";

    public static string ProjectFindingUrl(Guid projectId)
        => $"{Configuration.FrontendUrl}/project/{projectId}/finding";

    public static string ProjectDependencyUrl(Guid projectId)
        => $"{Configuration.FrontendUrl}/project/{projectId}/dependency";

    public static string FindingUrl(Guid findingId)
        => $"{Configuration.FrontendUrl}/finding/{findingId}";

    public static string ConfirmEmailUrl(string token, string username)
        => $"{Configuration.FrontendUrl}/auth/confirm-email?token={token}&username={username}";

    public static string ResetPasswordUrl(string token, string username)
        => $"{Configuration.FrontendUrl}/auth/reset-password?token={token}&username={username}";
}
