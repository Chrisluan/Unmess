namespace Unmess.Deployer.Events;

public static class CiEventTypes
{
    public const string ReleaseUpdated = "release.updated";
    public const string ProductionUpdated = "production.updated";
}

public sealed record CiEvent(
    string Type,
    string? Release,
    string? CommitSha,
    string? ImageTag,
    bool CiPassed,
    string? Version);
