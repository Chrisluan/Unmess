namespace Unmess.Deployer.Integrations;

public interface IContainerOrchestrator
{
    Task DeployPreviewAsync(string release, string imageTag, CancellationToken cancellationToken);
    Task RemovePreviewAsync(string release, CancellationToken cancellationToken);
    Task RunProductionMigratorAsync(string imageTag, CancellationToken cancellationToken);
    Task DeployProductionAsync(string imageTag, CancellationToken cancellationToken);
}

public interface ISourceControl
{
    Task<string> GetProductionShaAsync(CancellationToken cancellationToken);
    Task<bool> ContainsCommitAsync(string releaseSha, string ancestorSha, CancellationToken cancellationToken);
    Task FastForwardProductionAsync(string commitSha, CancellationToken cancellationToken);
    Task<IReadOnlyList<ReleaseHead>> ListReleaseHeadsAsync(CancellationToken cancellationToken);
}

public sealed record ReleaseHead(string Release, string CommitSha, bool CiPassed);

public interface IImageRegistry
{
    Task TagAsync(string sourceTag, string targetTag, CancellationToken cancellationToken);
}

public interface IBackupService
{
    Task<string> CreateVerifiedBackupAsync(string reason, CancellationToken cancellationToken);
}

public interface INotifier
{
    Task NotifyAsync(string message, CancellationToken cancellationToken);
}

public interface IHealthProbe
{
    Task<bool> IsHealthyAsync(string baseUrl, CancellationToken cancellationToken);
}
