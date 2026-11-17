using Unmess.Deployer.Releases;

namespace Unmess.Deployer.Data;

public sealed class Release
{
    public required string Name { get; set; }
    public ReleaseState State { get; set; }
    public required string CommitSha { get; set; }
    public required string ImageTag { get; set; }
    public bool CiPassed { get; set; }
    public string? PreviewUrl { get; set; }
    public string? Version { get; set; }
    public string? LastError { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AuditEntry
{
    public long Id { get; set; }
    public DateTimeOffset At { get; set; }
    public required string Actor { get; set; }
    public required string Action { get; set; }
    public string? Target { get; set; }
    public string? Details { get; set; }
}

public sealed class ProductionDeployment
{
    public long Id { get; set; }
    public required string Tag { get; set; }
    public required string CommitSha { get; set; }
    public string? Release { get; set; }
    public DateTimeOffset DeployedAt { get; set; }
    public bool IsCurrent { get; set; }
}

public sealed class ProcessedDelivery
{
    public required string Id { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
}
