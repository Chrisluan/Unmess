namespace Unmess.Deployer.Integrations;

public sealed class DryRunContainerOrchestrator(ILogger<DryRunContainerOrchestrator> logger) : IContainerOrchestrator
{
    public Task DeployPreviewAsync(string release, string imageTag, CancellationToken cancellationToken)
    {
        logger.LogInformation("Dry run: deploy preview {Release} with image {ImageTag}", release, imageTag);
        return Task.CompletedTask;
    }

    public Task RemovePreviewAsync(string release, CancellationToken cancellationToken)
    {
        logger.LogInformation("Dry run: remove preview {Release}", release);
        return Task.CompletedTask;
    }

    public Task RunProductionMigratorAsync(string imageTag, CancellationToken cancellationToken)
    {
        logger.LogInformation("Dry run: run production migrator {ImageTag}", imageTag);
        return Task.CompletedTask;
    }

    public Task DeployProductionAsync(string imageTag, CancellationToken cancellationToken)
    {
        logger.LogInformation("Dry run: deploy production image {ImageTag}", imageTag);
        return Task.CompletedTask;
    }
}

public sealed class DryRunSourceControl(ILogger<DryRunSourceControl> logger) : ISourceControl
{
    private string productionSha = string.Empty;

    public Task<string> GetProductionShaAsync(CancellationToken cancellationToken) => Task.FromResult(productionSha);

    public Task<bool> ContainsCommitAsync(string releaseSha, string ancestorSha, CancellationToken cancellationToken) =>
        Task.FromResult(true);

    public Task FastForwardProductionAsync(string commitSha, CancellationToken cancellationToken)
    {
        logger.LogInformation("Dry run: fast-forward production to {CommitSha}", commitSha);
        productionSha = commitSha;
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<ReleaseHead>> ListReleaseHeadsAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<ReleaseHead>>([]);
}

public sealed class DryRunImageRegistry(ILogger<DryRunImageRegistry> logger) : IImageRegistry
{
    public Task TagAsync(string sourceTag, string targetTag, CancellationToken cancellationToken)
    {
        logger.LogInformation("Dry run: tag image {SourceTag} as {TargetTag}", sourceTag, targetTag);
        return Task.CompletedTask;
    }
}

public sealed class DryRunBackupService(ILogger<DryRunBackupService> logger, TimeProvider timeProvider) : IBackupService
{
    public Task<string> CreateVerifiedBackupAsync(string reason, CancellationToken cancellationToken)
    {
        var id = $"dry-run-{timeProvider.GetUtcNow():yyyyMMddHHmmss}";
        logger.LogInformation("Dry run: backup {BackupId} for {Reason}", id, reason);
        return Task.FromResult(id);
    }
}

public sealed class DryRunHealthProbe : IHealthProbe
{
    public Task<bool> IsHealthyAsync(string baseUrl, CancellationToken cancellationToken) => Task.FromResult(true);
}

public sealed class LogNotifier(ILogger<LogNotifier> logger) : INotifier
{
    public Task NotifyAsync(string message, CancellationToken cancellationToken)
    {
        logger.LogInformation("Notification: {Message}", message);
        return Task.CompletedTask;
    }
}
