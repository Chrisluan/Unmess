using Microsoft.Extensions.Logging;
using Unmess.Application.WhatsappGateway;

namespace Unmess.Infrastructure.WhatsappGateway;

public sealed class LoggingGatewayEventHandler(ILogger<LoggingGatewayEventHandler> logger) : IGatewayEventHandler
{
    public Task HandleAsync(GatewayEventEnvelope envelope, CancellationToken cancellationToken)
    {
        logger.LogInformation(
            "Gateway event {EventId} {EventType} for session {SessionId}",
            envelope.Id,
            envelope.Type,
            envelope.SessionId);
        return Task.CompletedTask;
    }
}
