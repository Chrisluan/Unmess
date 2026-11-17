using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Unmess.Deployer.Data;
using Unmess.Deployer.Integrations;

namespace Unmess.Deployer.Releases;

public sealed class ReleaseCoordinator(
    DeployerDbContext db,
    AuditLog audit,
    DeploymentQueue queue,
    IContainerOrchestrator orchestrator,
    ISourceControl sourceControl,
    IImageRegistry registry,
    IBackupService backup,
    INotifier notifier,
    HealthGate healthGate,
    IOptions<DeployerOptions> options,
    TimeProvider timeProvider,
    ILogger<ReleaseCoordinator> logger)
{
    private DeployerOptions Settings => options.Value;

    public async Task<CommandResult> HandleReleaseUpdatedAsync(
        string name,
        string commitSha,
        string imageTag,
        bool ciPassed,
        string actor,
        CancellationToken cancellationToken)
    {
        if (!ReleaseName.IsValid(name) || string.IsNullOrWhiteSpace(commitSha) || string.IsNullOrWhiteSpace(imageTag))
        {
            return CommandResult.Invalid("release, commitSha and imageTag are required and the release must look like releaseNN.");
        }

        if (!ciPassed)
        {
            await audit.WriteAsync(actor, "release.ci_failed", name, commitSha, cancellationToken);
            return CommandResult.Ignored("CI did not pass.");
        }

        var release = await db.Releases.FindAsync([name], cancellationToken);
        if (release is null)
        {
            var now = timeProvider.GetUtcNow();
            release = new Release
            {
                Name = name,
                State = ReleaseState.Received,
                CommitSha = commitSha,
                ImageTag = imageTag,
                CiPassed = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.Releases.Add(release);
        }
        else if (ReleaseStateMachine.IsBusy(release.State))
        {
            await audit.WriteAsync(actor, "release.update_deferred", name, $"{commitSha} while {release.State}", cancellationToken);
            return CommandResult.Deferred($"Release is {release.State}; the update will be reconciled later.");
        }
        else if (release.CommitSha == commitSha && release.State is not (ReleaseState.Failed or ReleaseState.Discarded))
        {
            return CommandResult.Ignored("Commit already known.");
        }
        else
        {
            MoveTo(release, ReleaseState.Received);
            release.CommitSha = commitSha;
            release.ImageTag = imageTag;
            release.CiPassed = true;
            release.Version = null;
            release.LastError = null;
        }

        await db.SaveChangesAsync(cancellationToken);
        await audit.WriteAsync(actor, "release.received", name, commitSha, cancellationToken);
        await queue.EnqueueAsync(new DeploymentJob(DeploymentJobKind.DeployPreview, name, null, actor), cancellationToken);
        return CommandResult.Accepted();
    }

    public async Task<CommandResult> RequestRedeployAsync(string name, string actor, CancellationToken cancellationToken)
    {
        var release = await db.Releases.FindAsync([name], cancellationToken);
        if (release is null)
        {
            return CommandResult.NotFound($"Release {name} not found.");
        }

        if (!ReleaseStateMachine.CanTransition(release.State, ReleaseState.Received))
        {
            return CommandResult.Conflict($"Release is {release.State} and cannot be redeployed now.");
        }

        MoveTo(release, ReleaseState.Received);
        release.LastError = null;
        await db.SaveChangesAsync(cancellationToken);
        await audit.WriteAsync(actor, "preview.redeploy_requested", name, release.CommitSha, cancellationToken);
        await queue.EnqueueAsync(new DeploymentJob(DeploymentJobKind.DeployPreview, name, null, actor), cancellationToken);
        return CommandResult.Accepted();
    }

    public async Task<CommandResult> ApproveAsync(string name, string actor, CancellationToken cancellationToken)
    {
        var release = await db.Releases.FindAsync([name], cancellationToken);
        if (release is null)
        {
            return CommandResult.NotFound($"Release {name} not found.");
        }

        if (release.State != ReleaseState.AwaitingApproval || !release.CiPassed)
        {
            return CommandResult.Conflict($"Release is {release.State}; only a release awaiting approval with green CI can be approved.");
        }

        var productionSha = await sourceControl.GetProductionShaAsync(cancellationToken);
        if (!string.IsNullOrEmpty(productionSha) &&
            !await sourceControl.ContainsCommitAsync(release.CommitSha, productionSha, cancellationToken))
        {
            await audit.WriteAsync(actor, "release.approval_refused", name, "sync_required", cancellationToken);
            return CommandResult.Conflict($"Release {name} does not contain production ({productionSha}). Merge production into it first.");
        }

        MoveTo(release, ReleaseState.Approved);
        await db.SaveChangesAsync(cancellationToken);
        await audit.WriteAsync(actor, "release.approved", name, release.CommitSha, cancellationToken);
        await queue.EnqueueAsync(new DeploymentJob(DeploymentJobKind.Promote, name, null, actor), cancellationToken);
        return CommandResult.Accepted();
    }

    public async Task<CommandResult> RejectAsync(string name, string actor, CancellationToken cancellationToken)
    {
        var release = await db.Releases.FindAsync([name], cancellationToken);
        if (release is null)
        {
            return CommandResult.NotFound($"Release {name} not found.");
        }

        if (!ReleaseStateMachine.CanTransition(release.State, ReleaseState.Discarded))
        {
            return CommandResult.Conflict($"Release is {release.State} and cannot be rejected now.");
        }

        var hadPreview = ReleaseStateMachine.HasActivePreview(release.State);
        MoveTo(release, ReleaseState.Discarded);
        await db.SaveChangesAsync(cancellationToken);
        if (hadPreview)
        {
            await orchestrator.RemovePreviewAsync(name, cancellationToken);
        }

        await audit.WriteAsync(actor, "release.rejected", name, release.CommitSha, cancellationToken);
        return CommandResult.Accepted();
    }

    public async Task<CommandResult> RequestRollbackAsync(string? targetTag, string actor, CancellationToken cancellationToken)
    {
        var current = await CurrentDeploymentAsync(cancellationToken);
        if (current is null)
        {
            return CommandResult.Conflict("Production has no recorded deployment to roll back from.");
        }

        var tag = targetTag;
        if (string.IsNullOrWhiteSpace(tag))
        {
            tag = (await KnownTagsAsync(cancellationToken)).FirstOrDefault(known => known != current.Tag);
            if (tag is null)
            {
                return CommandResult.Conflict("There is no previous production image to roll back to.");
            }
        }
        else if (!(await KnownTagsAsync(cancellationToken)).Contains(tag))
        {
            return CommandResult.Invalid($"Tag {tag} is not among the kept production images.");
        }

        if (tag == current.Tag)
        {
            return CommandResult.Ignored($"Production already runs {tag}.");
        }

        await audit.WriteAsync(actor, "production.rollback_requested", tag, $"from {current.Tag}", cancellationToken);
        await queue.EnqueueAsync(new DeploymentJob(DeploymentJobKind.Rollback, null, tag, actor), cancellationToken);
        return CommandResult.Accepted();
    }

    public async Task<ProductionDeployment?> CurrentDeploymentAsync(CancellationToken cancellationToken) =>
        await db.ProductionDeployments.Where(deployment => deployment.IsCurrent)
            .OrderByDescending(deployment => deployment.Id)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<string>> KnownTagsAsync(CancellationToken cancellationToken)
    {
        var tags = await db.ProductionDeployments
            .OrderByDescending(deployment => deployment.Id)
            .Select(deployment => deployment.Tag)
            .ToListAsync(cancellationToken);
        return tags.Distinct().Take(Settings.KeptProductionImages).ToList();
    }

    public async Task ExecuteAsync(DeploymentJob job, CancellationToken cancellationToken)
    {
        switch (job.Kind)
        {
            case DeploymentJobKind.DeployPreview:
                await DeployPreviewAsync(job, cancellationToken);
                break;
            case DeploymentJobKind.Promote:
                await PromoteAsync(job, cancellationToken);
                break;
            case DeploymentJobKind.Rollback:
                await RollbackAsync(job, cancellationToken);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(job), job.Kind, "Unknown deployment job.");
        }
    }

    public async Task RecoverInterruptedAsync(CancellationToken cancellationToken)
    {
        var interrupted = await db.Releases
            .Where(release => release.State == ReleaseState.PreviewDeploying ||
                              release.State == ReleaseState.Approved ||
                              release.State == ReleaseState.Promoting)
            .ToListAsync(cancellationToken);

        foreach (var release in interrupted)
        {
            var previous = release.State;
            MoveTo(release, ReleaseState.Failed);
            release.LastError = $"Interrupted while {previous} by a Deployer restart.";
            await notifier.NotifyAsync($"{release.Name} was interrupted while {previous}. Check production before retrying.", cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        foreach (var release in interrupted)
        {
            await audit.WriteAsync("deployer", "release.interrupted", release.Name, release.LastError, cancellationToken);
        }
    }

    private async Task DeployPreviewAsync(DeploymentJob job, CancellationToken cancellationToken)
    {
        var release = await db.Releases.FindAsync([job.Release!], cancellationToken);
        if (release is null || release.State != ReleaseState.Received)
        {
            return;
        }

        var activePreviews = await db.Releases.CountAsync(
            other => other.Name != release.Name && ReleaseStateMachine.ActivePreviews.Contains(other.State),
            cancellationToken);
        if (activePreviews >= Settings.MaxActivePreviews)
        {
            await FailAsync(release, $"Preview limit of {Settings.MaxActivePreviews} reached.", cancellationToken);
            return;
        }

        MoveTo(release, ReleaseState.PreviewDeploying);
        release.PreviewUrl = Settings.PreviewUrlFor(release.Name);
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            await orchestrator.DeployPreviewAsync(release.Name, release.ImageTag, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogError(exception, "Preview deployment failed for {Release}", release.Name);
            await FailAsync(release, $"Preview deployment failed: {exception.Message}", cancellationToken);
            return;
        }

        if (!await healthGate.WaitUntilStableAsync(release.PreviewUrl, cancellationToken))
        {
            await FailAsync(release, "Preview did not become healthy.", cancellationToken);
            return;
        }

        MoveTo(release, ReleaseState.PreviewReady);
        MoveTo(release, ReleaseState.AwaitingApproval);
        await db.SaveChangesAsync(cancellationToken);
        await audit.WriteAsync(job.Actor, "preview.ready", release.Name, release.PreviewUrl, cancellationToken);
        await notifier.NotifyAsync($"{release.Name} ({ShortSha(release.CommitSha)}) is ready for review at {release.PreviewUrl}", cancellationToken);
    }

    private async Task PromoteAsync(DeploymentJob job, CancellationToken cancellationToken)
    {
        var release = await db.Releases.FindAsync([job.Release!], cancellationToken);
        if (release is null || release.State != ReleaseState.Approved)
        {
            return;
        }

        var previous = await CurrentDeploymentAsync(cancellationToken);
        var version = await NextVersionAsync(release.Name, cancellationToken);
        MoveTo(release, ReleaseState.Promoting);
        release.Version = version;
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            var backupId = await backup.CreateVerifiedBackupAsync($"promote {release.Name} as {version}", cancellationToken);
            await audit.WriteAsync(job.Actor, "backup.created", release.Name, backupId, cancellationToken);
            await sourceControl.FastForwardProductionAsync(release.CommitSha, cancellationToken);
            await registry.TagAsync(release.ImageTag, version, cancellationToken);
            await orchestrator.RunProductionMigratorAsync(version, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogError(exception, "Promotion of {Release} failed before switching production", release.Name);
            await FailAsync(release, $"Promotion failed before switching production: {exception.Message}", cancellationToken);
            return;
        }

        var healthy = false;
        try
        {
            await orchestrator.DeployProductionAsync(version, cancellationToken);
            healthy = await healthGate.WaitUntilStableAsync(Settings.ProductionUrl, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogError(exception, "Production switch to {Version} failed", version);
            release.LastError = exception.Message;
        }

        if (healthy)
        {
            await RecordProductionAsync(version, release.CommitSha, release.Name, cancellationToken);
            MoveTo(release, ReleaseState.Healthy);
            release.LastError = null;
            await db.SaveChangesAsync(cancellationToken);
            await orchestrator.RemovePreviewAsync(release.Name, cancellationToken);
            await audit.WriteAsync(job.Actor, "production.promoted", release.Name, version, cancellationToken);
            await notifier.NotifyAsync($"{release.Name} is live in production as {version}.", cancellationToken);
            return;
        }

        if (previous is null)
        {
            await FailAsync(release, release.LastError ?? "Production did not become healthy and there is no previous image.", cancellationToken);
            return;
        }

        await orchestrator.DeployProductionAsync(previous.Tag, cancellationToken);
        var restored = await healthGate.WaitUntilStableAsync(Settings.ProductionUrl, cancellationToken);
        MoveTo(release, ReleaseState.RolledBack);
        release.LastError = $"Production did not become healthy with {version}; rolled back to {previous.Tag}" +
                            (restored ? "." : ", which is also unhealthy.");
        await db.SaveChangesAsync(cancellationToken);
        await audit.WriteAsync(job.Actor, "production.auto_rollback", release.Name, release.LastError, cancellationToken);
        await notifier.NotifyAsync(release.LastError, cancellationToken);
    }

    private async Task RollbackAsync(DeploymentJob job, CancellationToken cancellationToken)
    {
        var tag = job.TargetTag!;
        var target = await db.ProductionDeployments
            .Where(deployment => deployment.Tag == tag)
            .OrderByDescending(deployment => deployment.Id)
            .FirstAsync(cancellationToken);

        await orchestrator.DeployProductionAsync(tag, cancellationToken);
        if (await healthGate.WaitUntilStableAsync(Settings.ProductionUrl, cancellationToken))
        {
            await RecordProductionAsync(tag, target.CommitSha, target.Release, cancellationToken);
            await audit.WriteAsync(job.Actor, "production.rolled_back", tag, null, cancellationToken);
            await notifier.NotifyAsync($"Production rolled back to {tag}.", cancellationToken);
            return;
        }

        await audit.WriteAsync(job.Actor, "production.rollback_unhealthy", tag, null, cancellationToken);
        await notifier.NotifyAsync($"Rollback to {tag} finished but production is not healthy. Manual action required.", cancellationToken);
    }

    private async Task RecordProductionAsync(string tag, string commitSha, string? releaseName, CancellationToken cancellationToken)
    {
        await db.ProductionDeployments.Where(deployment => deployment.IsCurrent)
            .ExecuteUpdateAsync(setters => setters.SetProperty(deployment => deployment.IsCurrent, false), cancellationToken);

        db.ProductionDeployments.Add(new ProductionDeployment
        {
            Tag = tag,
            CommitSha = commitSha,
            Release = releaseName,
            DeployedAt = timeProvider.GetUtcNow(),
            IsCurrent = true
        });
    }

    private async Task<string> NextVersionAsync(string releaseName, CancellationToken cancellationToken)
    {
        var prefix = $"v{Settings.MajorVersion}.{ReleaseName.NumberOf(releaseName)}.";
        var existing = await db.ProductionDeployments
            .Where(deployment => deployment.Tag.StartsWith(prefix))
            .Select(deployment => deployment.Tag)
            .Distinct()
            .CountAsync(cancellationToken);
        return prefix + existing;
    }

    private async Task FailAsync(Release release, string error, CancellationToken cancellationToken)
    {
        MoveTo(release, ReleaseState.Failed);
        release.LastError = error;
        await db.SaveChangesAsync(cancellationToken);
        await audit.WriteAsync("deployer", "release.failed", release.Name, error, cancellationToken);
        await notifier.NotifyAsync($"{release.Name} failed: {error}", cancellationToken);
    }

    private void MoveTo(Release release, ReleaseState target)
    {
        if (!ReleaseStateMachine.CanTransition(release.State, target))
        {
            throw new InvalidReleaseTransitionException(release.Name, release.State, target);
        }

        release.State = target;
        release.UpdatedAt = timeProvider.GetUtcNow();
    }

    private static string ShortSha(string sha) => sha.Length > 7 ? sha[..7] : sha;
}
