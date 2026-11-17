using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Unmess.Application.Common;
using Unmess.Application.WhatsappGateway;
using Unmess.Domain.Mensagens;
using Unmess.Domain.Tickets;

namespace Unmess.Application.Mensagens;

public sealed record AudioConvertido(string Arquivo, string TipoDeConteudo);

public interface IConversorDeAudio
{
    Task<AudioConvertido?> ParaMensagemDeVozAsync(string arquivo, CancellationToken cancellationToken);
}

public sealed record MidiaParaEnvio(string Arquivo, string TipoDeConteudo, string NomeOriginal, string? Legenda, bool ComoVoz, bool ComoDocumento, bool ComoFigurinha, string TipoDaMensagem);

public sealed partial class EnvioPeloWhatsapp(
    IUnmessDbContext db,
    IWhatsappGateway gateway,
    RegistroDeMensagens registro,
    IFileStorage arquivos,
    IConversorDeAudio conversorDeAudio,
    TimeProvider timeProvider,
    ILogger<EnvioPeloWhatsapp> logger)
{
    public const string ErroSemConexao = "ERR_TICKET_NO_WHATSAPP";
    public const string ErroAoEnviar = "ERR_SENDING_WAPP_MSG";

    [GeneratedRegex(@"^.*\.(jpe?g|png|gif)?$", RegexOptions.IgnoreCase)]
    private static partial Regex ImagemComum();

    public static string ChatId(Ticket ticket) => $"{ticket.Contato?.Numero}@{(ticket.EhGrupo ? "g" : "c")}.us";

    public async Task<Mensagem> EnviarTextoAsync(Ticket ticket, string corpo, Mensagem? citada, string ultimaMensagem, int? usuarioId, CancellationToken cancellationToken)
    {
        var sessao = Sessao(ticket);
        GatewaySendResult enviado;
        try
        {
            enviado = await gateway.SendAsync(sessao, new GatewaySendCommand(ChatId(ticket), corpo, null, citada?.Id, citada?.DeMim), cancellationToken);
        }
        catch (Exception exception) when (exception is GatewaySessionUnavailableException or HttpRequestException)
        {
            logger.LogError(exception, "Error sending WhatsApp message for ticket {TicketId}", ticket.Id);
            throw new AppException(ErroAoEnviar);
        }

        return await RegistrarAsync(ticket, enviado.MessageId, corpo, null, "chat", citada?.Id, ultimaMensagem, usuarioId, cancellationToken);
    }

    public async Task<Mensagem> EnviarMidiaAsync(Ticket ticket, MidiaParaEnvio midia, string ultimaMensagem, int? usuarioId, CancellationToken cancellationToken)
    {
        var sessao = Sessao(ticket);
        GatewaySendResult enviado;
        try
        {
            enviado = await gateway.SendAsync(sessao, new GatewaySendCommand(
                ChatId(ticket),
                null,
                new GatewayMedia(midia.Arquivo, midia.TipoDeConteudo, midia.NomeOriginal, midia.Legenda, midia.ComoVoz, midia.ComoDocumento, midia.ComoFigurinha)),
                cancellationToken);
        }
        catch (Exception exception) when (exception is GatewaySessionUnavailableException or HttpRequestException)
        {
            logger.LogError(exception, "Error sending WhatsApp media for ticket {TicketId}", ticket.Id);
            throw new AppException(ErroAoEnviar);
        }

        return await RegistrarAsync(ticket, enviado.MessageId, midia.Legenda ?? midia.NomeOriginal, midia.Arquivo, midia.TipoDaMensagem, null, ultimaMensagem, usuarioId, cancellationToken);
    }

    public async Task<MidiaParaEnvio> PrepararUploadAsync(ArquivoEnviado arquivo, string? legenda, CancellationToken cancellationToken)
    {
        var salvo = await arquivos.SalvarAsync(arquivo, cancellationToken);
        var tipo = arquivo.TipoDeConteudo;
        if (tipo.StartsWith("audio/", StringComparison.OrdinalIgnoreCase))
        {
            var convertido = await conversorDeAudio.ParaMensagemDeVozAsync(arquivos.CaminhoCompleto(salvo), cancellationToken);
            var audio = convertido is null ? salvo : Path.GetFileName(convertido.Arquivo);
            if (convertido is not null && audio != salvo)
            {
                arquivos.Remover(salvo);
            }
            return new MidiaParaEnvio(audio, "audio/ogg; codecs=opus", convertido is null ? arquivo.NomeOriginal : audio, legenda, true, false, false, "audio");
        }

        var comoDocumento = tipo.StartsWith("image/", StringComparison.OrdinalIgnoreCase) && !ImagemComum().IsMatch(salvo);
        var tipoDaMensagem = tipo.Split('/')[0];
        return new MidiaParaEnvio(salvo, tipo, arquivo.NomeOriginal, legenda, true, comoDocumento, false, tipoDaMensagem);
    }

    public async Task MarcarComoLidasAsync(Ticket ticket, CancellationToken cancellationToken)
    {
        if (ticket.ConexaoWhatsappId is null || ticket.Contato is null)
        {
            return;
        }

        var naoLidas = db.Mensagens.Where(mensagem => mensagem.TicketId == ticket.Id && !mensagem.DeMim)
            .OrderByDescending(mensagem => mensagem.CriadoEm).Take(20).Select(mensagem => mensagem.Id);
        try
        {
            var ids = naoLidas.ToList();
            if (ids.Count > 0)
            {
                await gateway.MarkReadAsync(Sessao(ticket), ChatId(ticket), ids, cancellationToken);
            }
        }
        catch (Exception exception) when (exception is GatewaySessionUnavailableException or HttpRequestException or AppException)
        {
            logger.LogWarning(exception, "Could not mark messages as read. Maybe whatsapp session disconnected?");
        }
    }

    private async Task<Mensagem> RegistrarAsync(Ticket ticket, string id, string corpo, string? arquivo, string tipo, string? citadaId, string ultimaMensagem, int? usuarioId, CancellationToken cancellationToken)
    {
        var rastreado = await db.Tickets.FindAsync([ticket.Id], cancellationToken);
        if (rastreado is not null)
        {
            rastreado.UltimaMensagem = ultimaMensagem;
        }

        return await registro.GravarAsync(new Mensagem
        {
            Id = id,
            TicketId = ticket.Id,
            Corpo = corpo,
            DeMim = true,
            Lida = true,
            Ack = 1,
            ArquivoDeMidia = arquivo,
            TipoDeMidia = tipo,
            CitadaId = citadaId,
            UsuarioId = usuarioId,
            Momento = timeProvider.GetUtcNow()
        }, cancellationToken);
    }

    private static string Sessao(Ticket ticket) =>
        ticket.ConexaoWhatsappId?.ToString(CultureInfo.InvariantCulture) ?? throw new AppException(ErroSemConexao);
}
