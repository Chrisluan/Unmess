using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Unmess.Deployer.Data;
using Unmess.Deployer.Events;
using Unmess.Deployer.Releases;

namespace Unmess.Deployer.Api;

public static class Endpoints
{
    private static readonly JsonSerializerOptions EventJson = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapDeployerApi(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/health/live", () => Results.Ok());
        endpoints.MapGet("/health/ready", async (DeployerDbContext db, CancellationToken cancellationToken) =>
            await db.Database.CanConnectAsync(cancellationToken) ? Results.Ok() : Results.StatusCode(StatusCodes.Status503ServiceUnavailable));

        var api = endpoints.MapGroup("/api/v1").RequireRateLimiting("api");

        api.MapPost("/events/github", ReceiveEventAsync);

        var secured = api.MapGroup(string.Empty).AddEndpointFilter<ApiTokenFilter>();

        secured.MapGet("/releases", async (DeployerDbContext db, CancellationToken cancellationToken) =>
            (await db.Releases.AsNoTracking().ToListAsync(cancellationToken))
            .OrderByDescending(release => release.UpdatedAt)
            .Select(ReleaseResponse.From));

        secured.MapGet("/releases/{name}", async (string name, DeployerDbContext db, CancellationToken cancellationToken) =>
            await db.Releases.AsNoTracking().FirstOrDefaultAsync(release => release.Name == name, cancellationToken) is { } release
                ? Results.Ok(ReleaseResponse.From(release))
                : Results.NotFound());

        secured.MapPost("/releases/{name}/preview/redeploy", async (string name, HttpContext context, ReleaseCoordinator coordinator, CancellationToken cancellationToken) =>
            (await coordinator.RequestRedeployAsync(name, context.Actor(), cancellationToken)).ToHttp());

        secured.MapPost("/releases/{name}/approve", async (string name, HttpContext context, ReleaseCoordinator coordinator, CancellationToken cancellationToken) =>
            (await coordinator.ApproveAsync(name, context.Actor(), cancellationToken)).ToHttp());

        secured.MapPost("/releases/{name}/reject", async (string name, HttpContext context, ReleaseCoordinator coordinator, CancellationToken cancellationToken) =>
            (await coordinator.RejectAsync(name, context.Actor(), cancellationToken)).ToHttp());

        secured.MapGet("/production/status", async (ReleaseCoordinator coordinator, CancellationToken cancellationToken) =>
        {
            var current = await coordinator.CurrentDeploymentAsync(cancellationToken);
            return new ProductionStatusResponse(
                current?.Tag,
                current?.CommitSha,
                current?.Release,
                current?.DeployedAt,
                await coordinator.KnownTagsAsync(cancellationToken));
        });

        secured.MapPost("/production/rollback", async (RollbackRequest? request, HttpContext context, ReleaseCoordinator coordinator, CancellationToken cancellationToken) =>
            (await coordinator.RequestRollbackAsync(request?.To, context.Actor(), cancellationToken)).ToHttp());

        secured.MapGet("/audit", async (int? limit, DeployerDbContext db, CancellationToken cancellationToken) =>
            (await db.AuditEntries.AsNoTracking()
                .OrderByDescending(entry => entry.Id)
                .Take(Math.Clamp(limit ?? 100, 1, 1000))
                .ToListAsync(cancellationToken))
            .Select(AuditEntryResponse.From));

        return endpoints;
    }

    private static async Task<IResult> ReceiveEventAsync(
        HttpRequest request,
        DeployerDbContext db,
        AuditLog audit,
        ReleaseCoordinator coordinator,
        IOptions<DeployerOptions> options,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(request.Body);
        var body = await reader.ReadToEndAsync(cancellationToken);

        var check = EventSignature.Verify(
            options.Value.WebhookSecret,
            request.Headers[EventSignature.TimestampHeader],
            request.Headers[EventSignature.SignatureHeader],
            body,
            timeProvider.GetUtcNow(),
            options.Value.SignatureTolerance);
        if (check != SignatureCheck.Valid)
        {
            return Results.Unauthorized();
        }

        var deliveryId = request.Headers[EventSignature.DeliveryHeader].ToString();
        if (string.IsNullOrWhiteSpace(deliveryId))
        {
            return Results.BadRequest(new CommandResponse("Invalid", $"{EventSignature.DeliveryHeader} is required."));
        }

        if (await db.ProcessedDeliveries.AnyAsync(delivery => delivery.Id == deliveryId, cancellationToken))
        {
            return Results.Ok(new CommandResponse("Duplicate", null));
        }

        CiEvent? ciEvent;
        try
        {
            ciEvent = JsonSerializer.Deserialize<CiEvent>(body, EventJson);
        }
        catch (JsonException)
        {
            ciEvent = null;
        }

        if (ciEvent is null)
        {
            return Results.BadRequest(new CommandResponse("Invalid", "Body is not a valid event."));
        }

        db.ProcessedDeliveries.Add(new ProcessedDelivery { Id = deliveryId, ReceivedAt = timeProvider.GetUtcNow() });
        await db.SaveChangesAsync(cancellationToken);

        switch (ciEvent.Type)
        {
            case CiEventTypes.ReleaseUpdated:
                return (await coordinator.HandleReleaseUpdatedAsync(
                    ciEvent.Release ?? string.Empty,
                    ciEvent.CommitSha ?? string.Empty,
                    ciEvent.ImageTag ?? string.Empty,
                    ciEvent.CiPassed,
                    "ci",
                    cancellationToken)).ToHttp();
            case CiEventTypes.ProductionUpdated:
                await audit.WriteAsync("ci", "production.updated", ciEvent.Version, ciEvent.CommitSha, cancellationToken);
                return Results.Ok(new CommandResponse("Recorded", null));
            default:
                return Results.BadRequest(new CommandResponse("Invalid", $"Unknown event type {ciEvent.Type}."));
        }
    }
}
