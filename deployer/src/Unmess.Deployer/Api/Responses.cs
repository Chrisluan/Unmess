using Unmess.Deployer.Data;
using Unmess.Deployer.Releases;

namespace Unmess.Deployer.Api;

public sealed record ReleaseResponse(
    string Name,
    string State,
    string CommitSha,
    string ImageTag,
    bool CiPassed,
    string? PreviewUrl,
    string? Version,
    string? LastError,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static ReleaseResponse From(Release release) => new(
        release.Name,
        release.State.ToString(),
        release.CommitSha,
        release.ImageTag,
        release.CiPassed,
        release.PreviewUrl,
        release.Version,
        release.LastError,
        release.CreatedAt,
        release.UpdatedAt);
}

public sealed record ProductionStatusResponse(
    string? CurrentTag,
    string? CurrentCommitSha,
    string? CurrentRelease,
    DateTimeOffset? DeployedAt,
    IReadOnlyList<string> KeptTags);

public sealed record AuditEntryResponse(long Id, DateTimeOffset At, string Actor, string Action, string? Target, string? Details)
{
    public static AuditEntryResponse From(AuditEntry entry) =>
        new(entry.Id, entry.At, entry.Actor, entry.Action, entry.Target, entry.Details);
}

public sealed record RollbackRequest(string? To);

public sealed record CommandResponse(string Status, string? Error);

public static class CommandResultHttp
{
    public static IResult ToHttp(this CommandResult result)
    {
        var body = new CommandResponse(result.Status.ToString(), result.Error);
        return result.Status switch
        {
            CommandStatus.Accepted => Results.Accepted(value: body),
            CommandStatus.Ignored or CommandStatus.Deferred => Results.Ok(body),
            CommandStatus.NotFound => Results.NotFound(body),
            CommandStatus.Conflict => Results.Conflict(body),
            _ => Results.BadRequest(body)
        };
    }
}
