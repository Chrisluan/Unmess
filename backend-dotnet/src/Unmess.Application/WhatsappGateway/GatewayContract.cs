using System.Text.Json;

namespace Unmess.Application.WhatsappGateway;

public sealed record GatewaySession(string SessionId, string Status, string? PhoneNumber, string? Qr, string? LastError, DateTimeOffset UpdatedAt);

public sealed record GatewaySendResult(string MessageId, string ChatId);

public sealed record GatewayMedia(string Ref, string Mimetype, string? Filename = null, string? Caption = null, bool? AsVoice = null, bool? AsDocument = null, bool? AsSticker = null);

public sealed record GatewaySendCommand(string To, string? Text = null, GatewayMedia? Media = null, string? QuotedMessageId = null, bool? QuotedFromMe = null);

public sealed record GatewayParticipant(string Jid, string Number, string? Lid, string Name, string? ProfilePicUrl);

public sealed record GatewayMediaReference(string Ref, string Mimetype, string? Filename);

public sealed record GatewayInboundMessage(
    string Id,
    string ChatId,
    string From,
    bool FromMe,
    bool FromApp,
    bool IsGroup,
    string? PushName,
    long Timestamp,
    string Kind,
    string? Text,
    GatewayMediaReference? Media,
    string? QuotedMessageId,
    GatewayParticipant Sender,
    GatewayParticipant? Group);

public sealed record GatewayMessageReceived(string SessionId, GatewayInboundMessage Message);

public sealed record GatewayMessageStatus(string SessionId, string MessageId, string ChatId, string Status);

public sealed record GatewayConnectionUpdate(string SessionId, string Status, string? PhoneNumber, string? Reason);

public sealed record GatewayQr(string SessionId, string Qr);

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

public sealed record GatewayNumberCheck(bool Exists, string? Jid);

public sealed record GatewayPhoneContact(string Jid, string Number, string? Name, string? PushName);

public sealed class GatewaySessionUnavailableException(string sessionId)
    : Exception($"WhatsApp session {sessionId} is not connected in the gateway.");

public interface IWhatsappGateway
{
    Task<GatewaySession> GetSessionAsync(string sessionId, CancellationToken cancellationToken);
    Task<GatewaySession> ConnectAsync(string sessionId, CancellationToken cancellationToken);
    Task<GatewaySession> DisconnectAsync(string sessionId, bool logout, CancellationToken cancellationToken);
    Task<GatewaySendResult> SendAsync(string sessionId, GatewaySendCommand command, CancellationToken cancellationToken);
    Task EditMessageAsync(string sessionId, string messageId, string chatId, string text, CancellationToken cancellationToken);
    Task DeleteMessageAsync(string sessionId, string messageId, string chatId, bool fromMe, CancellationToken cancellationToken);
    Task MarkReadAsync(string sessionId, string chatId, IReadOnlyList<string> messageIds, CancellationToken cancellationToken);
    Task<GatewayNumberCheck> CheckNumberAsync(string sessionId, string number, CancellationToken cancellationToken);
    Task<string?> GetProfilePictureAsync(string sessionId, string jid, CancellationToken cancellationToken);
    Task<IReadOnlyList<GatewayPhoneContact>> ListContactsAsync(string sessionId, CancellationToken cancellationToken);
}

public interface IGatewayEventHandler
{
    Task HandleAsync(GatewayEventEnvelope envelope, CancellationToken cancellationToken);
}
