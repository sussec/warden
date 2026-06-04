using Warden.Application.Module.Integration.Teams.Client;
using Warden.Application.Module.Integration.Teams.Client.Action;
using Warden.Core.Enum;
using FluentResults;

namespace Warden.Application.Module.Integration.Teams;

public class AlertScanCompleteTeams(string webhook) : IAlertScanComplete
{
    public async Task<Result<bool>> AlertAsync(List<string> receivers, AlertScanCompleteModel model)
    {
        try
        {
            var title = $"Scan on \"{model.Project.Name}\" by {model.Scanner.Name} completed";
            var text = $"**Commit:** [{model.GitCommit.CommitTitle}]({model.CommitUrl()})\n\n";
            if (model.GitCommit.Type == CommitType.CommitBranch)
            {
                text += $"**Branch:** {model.GitCommit.Branch}\n\n";
            }
            else if (model.GitCommit.Type == CommitType.CommitTag)
            {
                text += $"\n\n**Tag:** {model.GitCommit.Branch}\n\n";
            }
            else if (model.GitCommit.Type == CommitType.MergeRequest)
            {
                text +=
                    $"\n\n**Merge Request:** **[{model.GitCommit.Branch}]({model.MergeRequestUrl()})** to **{model.GitCommit.TargetBranch}**\n\n\n";
            }

            text += "| **New** | **Pending Fix** | **Fixed** |\n";
            text += "|-------------|-------------|-------------|\n";
            text += $"| {model.NewFindingCount} | {model.ConfirmedFindingCount} | {model.FixedFindingCount} |\n";
            var message = new MessageCard(title)
            {
                Text = text,
                Actions =
                [
                    new OpenUriAction("View Detail", model.FindingUrl()),
                ]
            };
            await new TeamsClient(webhook).PostAsync(message);
            return true;
        }
        catch (Exception e)
        {
            return Result.Fail(e.Message);
        }
    }
}