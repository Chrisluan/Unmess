using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Unmess.Deployer.Data;
using Unmess.Deployer.Integrations;

namespace Unmess.Deployer.Releases;

public sealed class DatabaseInitializer(IServiceScopeFactory scopeFactory) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<DeployerDbContext>().Database.EnsureCreatedAsync(cancellationToken);
        await scope.ServiceProvider.GetRequiredService<ReleaseCoordinator>().RecoverInterruptedAsync(cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

public sealed class DeploymentWorker(
    DeploymentQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<DeploymentWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<ReleaseCoordinator>().ExecuteAsync(job, stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Deployment job {Kind} for {Release} failed", job.Kind, job.Release ?? job.TargetTag);
            }
        }
    }
}

public sealed class ReconciliationWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<DeployerOptions> options,
    TimeProvider timeProvider,
    ILogger<ReconciliationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.ReconciliationInterval, timeProvider);
        do
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var sourceControl = scope.ServiceProvider.GetRequiredService<ISourceControl>();
                var coordinator = scope.ServiceProvider.GetRequiredService<ReleaseCoordinator>();
                foreach (var head in await sourceControl.ListReleaseHeadsAsync(stoppingToken))
                {
                    await coordinator.HandleReleaseUpdatedAsync(
                        head.Release, head.CommitSha, $"sha-{head.CommitSha}", head.CiPassed, "reconciler", stoppingToken);
                }

                await scope.ServiceProvider.GetRequiredService<DeployerDbContext>().ProcessedDeliveries
                    .Where(delivery => delivery.ReceivedAt < timeProvider.GetUtcNow().AddDays(-7))
                    .ExecuteDeleteAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Reconciliation failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
