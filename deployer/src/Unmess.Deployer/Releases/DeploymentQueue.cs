using System.Threading.Channels;

namespace Unmess.Deployer.Releases;

public enum DeploymentJobKind
{
    DeployPreview,
    Promote,
    Rollback
}

public sealed record DeploymentJob(DeploymentJobKind Kind, string? Release, string? TargetTag, string Actor);

public sealed class DeploymentQueue
{
    private readonly Channel<DeploymentJob> channel = Channel.CreateUnbounded<DeploymentJob>(
        new UnboundedChannelOptions { SingleReader = true });

    public ValueTask EnqueueAsync(DeploymentJob job, CancellationToken cancellationToken) =>
        channel.Writer.WriteAsync(job, cancellationToken);

    public IAsyncEnumerable<DeploymentJob> ReadAllAsync(CancellationToken cancellationToken) =>
        channel.Reader.ReadAllAsync(cancellationToken);
}
