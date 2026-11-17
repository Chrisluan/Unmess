namespace Unmess.Deployer.Releases;

public enum ReleaseState
{
    Received,
    PreviewDeploying,
    PreviewReady,
    AwaitingApproval,
    Approved,
    Promoting,
    Healthy,
    Failed,
    RolledBack,
    Discarded
}
