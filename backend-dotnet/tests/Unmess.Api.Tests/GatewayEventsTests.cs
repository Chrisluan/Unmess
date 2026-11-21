using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Unmess.Api.Tests.Support;
using Unmess.Application.WhatsappGateway;
using Unmess.Infrastructure.WhatsappGateway;

namespace Unmess.Api.Tests;

public sealed class GatewayEventsTests : IDisposable
{
    private const string Secret = "gateway-webhook-secret";
    private readonly RecordingHandler handler = new();
    private readonly WebApplicationFactory<Program> factory;

    public GatewayEventsTests()
    {
        factory = new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("WhatsappGateway:WebhookSecret", Secret);
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IGatewayEventHandler>();
                services.AddSingleton<IGatewayEventHandler>(handler);
            });
        });
    }

    public void Dispose() => factory.Dispose();

    private static HttpRequestMessage Signed(Guid id, string secret = Secret, DateTimeOffset? at = null)
    {
        var body = JsonSerializer.Serialize(new
        {
            id,
            version = "v1",
            occurredAt = DateTimeOffset.UtcNow,
            @event = new { type = "message.received", sessionId = "7", message = new { id = "ABC", text = "Oi" } }
        });
        var timestamp = (at ?? DateTimeOffset.UtcNow).ToUnixTimeSeconds();
        var request = new HttpRequestMessage(HttpMethod.Post, "/internal/whatsapp-gateway/events")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        request.Headers.Add(EventSignature.TimestampHeader, timestamp.ToString(CultureInfo.InvariantCulture));
        request.Headers.Add(EventSignature.SignatureHeader, EventSignature.Compute(secret, timestamp, body));
        request.Headers.Add(EventSignature.DeliveryHeader, id.ToString());
        return request;
    }

    [Fact]
    public async Task Accepts_signed_event_once()
    {
        var client = factory.CreateClient();
        var id = Guid.NewGuid();

        var first = await client.SendAsync(Signed(id));
        var second = await client.SendAsync(Signed(id));

        Assert.Equal(HttpStatusCode.Accepted, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var envelope = Assert.Single(handler.Received);
        Assert.Equal("message.received", envelope.Type);
        Assert.Equal("7", envelope.SessionId);
    }

    [Fact]
    public async Task Rejects_wrong_signature()
    {
        var response = await factory.CreateClient().SendAsync(Signed(Guid.NewGuid(), "another-secret"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(handler.Received);
    }

    [Fact]
    public async Task Rejects_replayed_event()
    {
        var response = await factory.CreateClient().SendAsync(Signed(Guid.NewGuid(), at: DateTimeOffset.UtcNow.AddMinutes(-10)));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private sealed class RecordingHandler : IGatewayEventHandler
    {
        public List<GatewayEventEnvelope> Received { get; } = [];

        public Task HandleAsync(GatewayEventEnvelope envelope, CancellationToken cancellationToken)
        {
            Received.Add(envelope);
            return Task.CompletedTask;
        }
    }
}
