using Unmess.Deployer.Releases;

namespace Unmess.Deployer.Tests;

public sealed class ReleaseStateMachineTests
{
    [Theory]
    [InlineData(ReleaseState.Received, ReleaseState.PreviewDeploying)]
    [InlineData(ReleaseState.PreviewDeploying, ReleaseState.PreviewReady)]
    [InlineData(ReleaseState.PreviewReady, ReleaseState.AwaitingApproval)]
    [InlineData(ReleaseState.AwaitingApproval, ReleaseState.Approved)]
    [InlineData(ReleaseState.Approved, ReleaseState.Promoting)]
    [InlineData(ReleaseState.Promoting, ReleaseState.Healthy)]
    [InlineData(ReleaseState.Promoting, ReleaseState.RolledBack)]
    [InlineData(ReleaseState.AwaitingApproval, ReleaseState.Discarded)]
    public void Allows_the_documented_flow(ReleaseState from, ReleaseState to)
    {
        Assert.True(ReleaseStateMachine.CanTransition(from, to));
    }

    [Theory]
    [InlineData(ReleaseState.Received, ReleaseState.Approved)]
    [InlineData(ReleaseState.PreviewReady, ReleaseState.Promoting)]
    [InlineData(ReleaseState.Promoting, ReleaseState.Received)]
    [InlineData(ReleaseState.Approved, ReleaseState.Discarded)]
    [InlineData(ReleaseState.Healthy, ReleaseState.Approved)]
    public void Blocks_shortcuts(ReleaseState from, ReleaseState to)
    {
        Assert.False(ReleaseStateMachine.CanTransition(from, to));
    }

    [Theory]
    [InlineData("release01", true)]
    [InlineData("release123", true)]
    [InlineData("release1", false)]
    [InlineData("production", false)]
    [InlineData("SMS/23510", false)]
    public void Validates_release_names(string name, bool valid)
    {
        Assert.Equal(valid, ReleaseName.IsValid(name));
    }
}
