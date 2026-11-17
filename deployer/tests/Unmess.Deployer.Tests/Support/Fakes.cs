using System.Collections.Concurrent;
using Unmess.Deployer.Integrations;

namespace Unmess.Deployer.Tests.Support;

public sealed class FakeSourceControl : ISourceControl
{
    public string ProductionSha { get; set; } = string.Empty;
    public bool ReleasesContainProduction { get; set; } = true;
    public ConcurrentQueue<string> FastForwards { get; } = new();

    public Task<string> GetProductionShaAsync(CancellationToken cancellationToken) => Task.FromResult(ProductionSha);

    public Task<bool> ContainsCommitAsync(string releaseSha, string ancestorSha, CancellationToken cancellationToken) =>
        Task.FromResult(ReleasesContainProduction);

    public Task FastForwardProductionAsync(string commitSha, CancellationToken cancellationToken)
    {
        FastForwards.Enqueue(commitSha);
        ProductionSha = commitSha;
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<ReleaseHead>> ListReleaseHeadsAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<ReleaseHead>>([]);
}

public sealed class RecordingOrchestrator : IContainerOrchestrator
{
    public ConcurrentQueue<string> Calls { get; } = new();

    public Task DeployPreviewAsync(string release, string imageTag, CancellationToken cancellationToken) =>
        Record($"preview:{release}:{imageTag}");

    public Task RemovePreviewAsync(string release, CancellationToken cancellationToken) =>
        Record($"remove-preview:{release}");

    public Task RunProductionMigratorAsync(string imageTag, CancellationToken cancellationToken) =>
        Record($"migrate:{imageTag}");

    public Task DeployProductionAsync(string imageTag, CancellationToken cancellationToken) =>
        Record($"production:{imageTag}");

    private Task Record(string call)
    {
        Calls.Enqueue(call);
        return Task.CompletedTask;
    }
}

public sealed class FakeHealthProbe(RecordingOrchestrator orchestrator) : IHealthProbe
{
    public HashSet<string> UnhealthyProductionTags { get; } = [];

    public Task<bool> IsHealthyAsync(string baseUrl, CancellationToken cancellationToken)
    {
        if (!baseUrl.Contains("app.", StringComparison.Ordinal))
        {
            return Task.FromResult(true);
        }

        var running = orchestrator.Calls.LastOrDefault(call => call.StartsWith("production:", StringComparison.Ordinal));
        var tag = running?["production:".Length..];
        return Task.FromResult(tag is null || !UnhealthyProductionTags.Contains(tag));
    }
}
