using System.Text.Json;

namespace Unmess.Application.WhatsappGateway;

public sealed record GatewaySession(string SessionId, string Status, string? PhoneNumber, string? Qr, string? LastError, DateTimeOffset UpdatedAt);

public sealed record GatewaySendResult(string MessageId, string ChatId);

public sealed record GatewayMedia(string Ref, string Mimetype, string? Filename = null, string? Caption = null, bool? AsVoice = null, bool? AsDocument = null, bool? AsSticker = null);

public sealed record GatewaySendCommand(string To, string? Text = null, GatewayMedia? Media = null, string? QuotedMessageId = null);

public sealed record GatewayEventEnvelope(Guid Id, string Version, DateTimeOffset OccurredAt, JsonElement Event)
{
    public string Type => Event.TryGetProperty("type", out var type) ? type.GetString() ?? string.Empty : string.Empty;

    public string SessionId => Event.TryGetProperty("sessionId", out var session) ? session.GetString() ?? string.Empty : string.Empty;
}

public static class GatewayEventTypes
{
    public const string MessageReceived = "message.received";
    public const string MessageStatus = "message.status";
    public const string ConnectionUpdate = "connection.update";
    public const string Qr = "qr";
}

public interface IWhatsappGateway
{
    Task<GatewaySession> GetSessionAsync(string sessionId, CancellationToken cancellationToken);
    Task<GatewaySession> ConnectAsync(string sessionId, CancellationToken cancellationToken);
    Task<GatewaySession> DisconnectAsync(string sessionId, bool logout, CancellationToken cancellationToken);
    Task<GatewaySendResult> SendAsync(string sessionId, GatewaySendCommand command, CancellationToken cancellationToken);
}

public interface IGatewayEventHandler
{
    Task HandleAsync(GatewayEventEnvelope envelope, CancellationToken cancellationToken);
}
