using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Unmess.Application.Common;
using Unmess.Application.Conexoes;
using Unmess.Application.Mensagens;

namespace Unmess.Application.WhatsappGateway;

public sealed class TratadorDeEventosDoGateway(
    IUnmessDbContext db,
    RecebimentoDeMensagens recebimento,
    RegistroDeMensagens registro,
    ConexaoService conexoes,
    ILogger<TratadorDeEventosDoGateway> logger) : IGatewayEventHandler
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task HandleAsync(GatewayEventEnvelope envelope, CancellationToken cancellationToken)
    {
        switch (envelope.Type)
        {
            case GatewayEventTypes.MessageReceived:
                var recebida = envelope.Event.Deserialize<GatewayMessageReceived>(Json)!;
                if (Conexao(recebida.SessionId) is { } conexaoDaMensagem)
                {
                    await recebimento.ProcessarAsync(conexaoDaMensagem, recebida.Message, cancellationToken);
                }
                break;
            case GatewayEventTypes.MessageStatus:
                var situacao = envelope.Event.Deserialize<GatewayMessageStatus>(Json)!;
                await AtualizarAckAsync(situacao, cancellationToken);
                break;
            case GatewayEventTypes.ConnectionUpdate:
                var conexao = envelope.Event.Deserialize<GatewayConnectionUpdate>(Json)!;
                if (Conexao(conexao.SessionId) is { } conexaoId)
                {
                    await conexoes.AplicarSituacaoDoGatewayAsync(conexaoId, conexao.Status, conexao.PhoneNumber, cancellationToken);
                }
                break;
            case GatewayEventTypes.Qr:
                var qr = envelope.Event.Deserialize<GatewayQr>(Json)!;
                if (Conexao(qr.SessionId) is { } conexaoDoQr)
                {
                    await conexoes.AplicarQrCodeAsync(conexaoDoQr, qr.Qr, cancellationToken);
                }
                break;
            default:
                logger.LogWarning("Unknown gateway event {EventType}", envelope.Type);
                break;
        }
    }

    private async Task AtualizarAckAsync(GatewayMessageStatus situacao, CancellationToken cancellationToken)
    {
        var mensagem = await db.Mensagens.FirstOrDefaultAsync(item => item.Id == situacao.MessageId, cancellationToken);
        if (mensagem is null)
        {
            return;
        }

        mensagem.Ack = AckDaMensagem.DaSituacao(situacao.Status);
        await db.SaveChangesAsync(cancellationToken);
        await registro.AvisarAtualizacaoAsync(mensagem.Id, cancellationToken);
    }

    private int? Conexao(string sessionId)
    {
        if (int.TryParse(sessionId, NumberStyles.None, CultureInfo.InvariantCulture, out var id))
        {
            return id;
        }

        logger.LogWarning("Gateway session {SessionId} is not a connection id", sessionId);
        return null;
    }
}
