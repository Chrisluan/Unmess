using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace Unmess.Deployer.Api;

public sealed class ApiTokenFilter(IOptions<DeployerOptions> options) : IEndpointFilter
{
    public const string ActorItemKey = "deployer.actor";
    public const string ActorHeader = "X-Unmess-Actor";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var header = context.HttpContext.Request.Headers.Authorization.ToString();
        const string scheme = "Bearer ";
        if (!header.StartsWith(scheme, StringComparison.OrdinalIgnoreCase) || !Matches(header[scheme.Length..].Trim()))
        {
            return Results.Unauthorized();
        }

        var actor = context.HttpContext.Request.Headers["Cf-Access-Authenticated-User-Email"].ToString();
        if (string.IsNullOrWhiteSpace(actor))
        {
            actor = context.HttpContext.Request.Headers[ActorHeader].ToString();
        }

        context.HttpContext.Items[ActorItemKey] = string.IsNullOrWhiteSpace(actor) ? "api-token" : actor;
        return await next(context);
    }

    private bool Matches(string token) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(token),
            Encoding.UTF8.GetBytes(options.Value.ApiToken));
}

public static class HttpContextActorExtensions
{
    public static string Actor(this HttpContext context) =>
        context.Items[ApiTokenFilter.ActorItemKey] as string ?? "unknown";
}
