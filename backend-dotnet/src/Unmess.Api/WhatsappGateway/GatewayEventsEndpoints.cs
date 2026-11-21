using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Unmess.Application.WhatsappGateway;
using Unmess.Infrastructure.WhatsappGateway;

namespace Unmess.Api.WhatsappGateway;

public static class GatewayEventsEndpoints
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapGatewayEventsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/internal/whatsapp-gateway/events", ReceiveAsync).AllowAnonymous();
        return endpoints;
    }

    private static async Task<IResult> ReceiveAsync(
        HttpRequest request,
        IOptions<WhatsappGatewayOptions> options,
        IMemoryCache processed,
        IGatewayEventHandler handler,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(request.Body);
        var body = await reader.ReadToEndAsync(cancellationToken);

        if (!EventSignature.IsValid(
                options.Value.WebhookSecret,
                request.Headers[EventSignature.TimestampHeader],
                request.Headers[EventSignature.SignatureHeader],
                body,
                timeProvider.GetUtcNow(),
                options.Value.SignatureTolerance))
        {
            return Results.Unauthorized();
        }

        GatewayEventEnvelope? envelope;
        try
        {
            envelope = JsonSerializer.Deserialize<GatewayEventEnvelope>(body, Json);
        }
        catch (JsonException)
        {
            envelope = null;
        }

        if (envelope is null || envelope.Id == Guid.Empty || envelope.Event.ValueKind != JsonValueKind.Object)
        {
            return Results.BadRequest();
        }

        var cacheKey = $"gateway-event:{envelope.Id}";
        if (processed.TryGetValue(cacheKey, out _))
        {
            return Results.Ok();
        }

        await handler.HandleAsync(envelope, cancellationToken);
        processed.Set(cacheKey, true, TimeSpan.FromHours(24));
        return Results.Accepted();
    }
}
