using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Unmess.Infrastructure;

namespace Unmess.Api.Health;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false })
            .AllowAnonymous();

        endpoints.MapHealthChecks("/health/ready", new HealthCheckOptions
            {
                Predicate = check => check.Tags.Contains(DependencyInjection.ReadyTag)
            })
            .AllowAnonymous();

        return endpoints;
    }
}
