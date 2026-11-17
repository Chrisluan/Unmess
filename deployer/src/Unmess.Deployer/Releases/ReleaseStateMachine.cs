namespace Unmess.Deployer.Releases;

public static class ReleaseStateMachine
{
    private static readonly Dictionary<ReleaseState, ReleaseState[]> AllowedTransitions = new()
    {
        [ReleaseState.Received] = [ReleaseState.PreviewDeploying, ReleaseState.Failed, ReleaseState.Discarded],
        [ReleaseState.PreviewDeploying] = [ReleaseState.PreviewReady, ReleaseState.Failed],
        [ReleaseState.PreviewReady] = [ReleaseState.AwaitingApproval, ReleaseState.Received, ReleaseState.Failed, ReleaseState.Discarded],
        [ReleaseState.AwaitingApproval] = [ReleaseState.Approved, ReleaseState.Received, ReleaseState.Discarded],
        [ReleaseState.Approved] = [ReleaseState.Promoting, ReleaseState.Failed],
        [ReleaseState.Promoting] = [ReleaseState.Healthy, ReleaseState.Failed, ReleaseState.RolledBack],
        [ReleaseState.Healthy] = [ReleaseState.Received],
        [ReleaseState.Failed] = [ReleaseState.Received, ReleaseState.Discarded],
        [ReleaseState.RolledBack] = [ReleaseState.Received, ReleaseState.Discarded],
        [ReleaseState.Discarded] = [ReleaseState.Received]
    };

    private static readonly HashSet<ReleaseState> BusyStates =
        [ReleaseState.PreviewDeploying, ReleaseState.Approved, ReleaseState.Promoting];

    private static readonly ReleaseState[] ActivePreviewStates =
        [ReleaseState.PreviewDeploying, ReleaseState.PreviewReady, ReleaseState.AwaitingApproval];

    public static bool CanTransition(ReleaseState from, ReleaseState to) =>
        AllowedTransitions.TryGetValue(from, out var targets) && targets.Contains(to);

    public static bool IsBusy(ReleaseState state) => BusyStates.Contains(state);

    public static bool HasActivePreview(ReleaseState state) => ActivePreviewStates.Contains(state);

    public static ReleaseState[] ActivePreviews => [.. ActivePreviewStates];
}

public sealed class InvalidReleaseTransitionException(string release, ReleaseState from, ReleaseState to)
    : InvalidOperationException($"Release {release} cannot move from {from} to {to}.");
