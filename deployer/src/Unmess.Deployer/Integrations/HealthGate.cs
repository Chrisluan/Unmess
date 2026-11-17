using Microsoft.Extensions.Options;

namespace Unmess.Deployer.Integrations;

public sealed class HealthGate(IHealthProbe probe, IOptions<DeployerOptions> options, TimeProvider timeProvider)
{
    public async Task<bool> WaitUntilStableAsync(string baseUrl, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var deadline = timeProvider.GetUtcNow() + settings.HealthCheckWindow;
        var consecutiveHealthy = 0;

        while (true)
        {
            consecutiveHealthy = await probe.IsHealthyAsync(baseUrl, cancellationToken) ? consecutiveHealthy + 1 : 0;
            if (consecutiveHealthy >= settings.RequiredHealthyChecks)
            {
                return true;
            }

            if (timeProvider.GetUtcNow() >= deadline)
            {
                return false;
            }

            await Task.Delay(settings.HealthCheckInterval, timeProvider, cancellationToken);
        }
    }
}
