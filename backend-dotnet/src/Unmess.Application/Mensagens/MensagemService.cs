using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Unmess.Application.Common;
using Unmess.Application.Contatos;
using Unmess.Application.Tickets;
using Unmess.Application.Usuarios;
using Unmess.Application.WhatsappGateway;
using Unmess.Domain.Mensagens;
using Unmess.Domain.Tickets;

namespace Unmess.Application.Mensagens;

public sealed record ListaDeMensagens(
    [property: JsonPropertyName("count")] int Total,
    [property: JsonPropertyName("messages")] IReadOnlyList<MensagemResposta> Mensagens,
    [property: JsonPropertyName("ticket")] TicketResposta Ticket,
    [property: JsonPropertyName("hasMore")] bool TemMais);

public sealed record MensagemCitada
{
    [JsonPropertyName("id")] public string? Id { get; init; }
    [JsonPropertyName("fromMe")] public bool? DeMim { get; init; }
}

public sealed record DadosDaMensagem
{
    [JsonPropertyName("body")] public string? Corpo { get; init; }
    [JsonPropertyName("quotedMsg")] public MensagemCitada? Citada { get; init; }
}

public sealed record DadosDeEncaminhamento
{
    [JsonPropertyName("toTicketId")] public int? TicketDestinoId { get; init; }
    [JsonPropertyName("toContactId")] public int? ContatoDestinoId { get; init; }
}

public sealed class MensagemService(
    IUnmessDbContext db,
    IUsuarioAtual usuarioAtual,
    TicketService tickets,
    EnvioPeloWhatsapp envio,
    RegistroDeMensagens registro,
    IWhatsappGateway gateway,
    IFileStorage arquivos,
    IRealtimePublisher realtime,
    ILogger<MensagemService> logger)
{
    public const string ErroNaoEncontrada = "No message found with this ID.";
    public const string ErroNaoEncontradaParaEncaminhar = "ERR_NO_MESSAGE_FOUND";
    public const int TamanhoDaPagina = 20;

    private static readonly IReadOnlyDictionary<string, string> TiposPorExtensao = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png", [".gif"] = "image/gif", [".webp"] = "image/webp",
        [".mp4"] = "video/mp4", [".3gp"] = "video/3gpp", [".mp3"] = "audio/mpeg", [".ogg"] = "audio/ogg", [".opus"] = "audio/ogg",
        [".m4a"] = "audio/mp4", [".pdf"] = "application/pdf", [".doc"] = "application/msword",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".xls"] = "application/vnd.ms-excel", [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".zip"] = "application/zip", [".txt"] = "text/plain"
    };

    public async Task<ListaDeMensagens> ListarAsync(int ticketId, string? pagina, string? busca, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var ticket = await tickets.CarregarAsync(ticketId, empresaId, cancellationToken);

        var consulta = db.Mensagens.AsNoTracking().Where(mensagem => mensagem.TicketId == ticketId);
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var padrao = $"%{busca.Trim()}%";
            consulta = consulta.Where(mensagem => EF.Functions.Like(mensagem.Corpo, padrao));
        }

        var total = await consulta.CountAsync(cancellationToken);
        var deslocamento = TamanhoDaPagina * (Math.Max(1, int.TryParse(pagina, out var numero) ? numero : 1) - 1);
        var mensagens = await consulta.ComDetalhes()
            .OrderByDescending(mensagem => mensagem.Momento ?? mensagem.CriadoEm)
            .Skip(deslocamento)
            .Take(TamanhoDaPagina)
            .ToListAsync(cancellationToken);
        mensagens.Reverse();

        var resposta = new ListaDeMensagens(total, mensagens.Select(MensagemResposta.De).ToList(), TicketResposta.De(ticket, comCamposDoContato: true), total > deslocamento + mensagens.Count);
        if (string.IsNullOrWhiteSpace(busca))
        {
            await tickets.MarcarMensagensComoLidasAsync(ticket, cancellationToken);
        }

        return resposta;
    }

    public async Task EnviarAsync(int ticketId, DadosDaMensagem dados, IReadOnlyList<ArquivoEnviado> midias, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var ticket = await tickets.CarregarAsync(ticketId, empresaId, cancellationToken);
        await tickets.MarcarMensagensComoLidasAsync(ticket, cancellationToken);

        if (midias.Count > 0)
        {
            foreach (var arquivo in midias)
            {
                var legenda = string.IsNullOrEmpty(dados.Corpo) ? null : FormatadorDeMensagem.Formatar(dados.Corpo, ticket.Contato);
                var midia = await envio.PrepararUploadAsync(arquivo, legenda, cancellationToken);
                await envio.EnviarMidiaAsync(ticket, midia, string.IsNullOrEmpty(dados.Corpo) ? arquivo.NomeOriginal : dados.Corpo, null, cancellationToken);
            }
            return;
        }

        var corpo = dados.Corpo ?? string.Empty;
        Mensagem? citada = null;
        if (!string.IsNullOrEmpty(dados.Citada?.Id))
        {
            citada = await db.Mensagens.AsNoTracking().FirstOrDefaultAsync(mensagem => mensagem.Id == dados.Citada.Id, cancellationToken)
                     ?? new Mensagem { Id = dados.Citada.Id, DeMim = dados.Citada.DeMim == true };
        }

        await envio.EnviarTextoAsync(ticket, FormatadorDeMensagem.Formatar(corpo, ticket.Contato), citada, corpo, null, cancellationToken);
    }

    public async Task<MensagemResposta> CriarNotaInternaAsync(int ticketId, DadosDaMensagem dados, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dados.Corpo))
        {
            throw new AppException("ERR_EMPTY_INTERNAL_NOTE");
        }

        var usuario = usuarioAtual.Exigir();
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var ticket = await tickets.CarregarAsync(ticketId, empresaId, cancellationToken);
        var nota = new Mensagem
        {
            Id = $"note_{Guid.NewGuid()}",
            TicketId = ticket.Id,
            Corpo = dados.Corpo.Trim(),
            DeMim = true,
            Lida = true,
            Interna = true,
            UsuarioId = usuario.Id
        };
        db.Mensagens.Add(nota);
        await db.SaveChangesAsync(cancellationToken);

        var mensagem = await db.Mensagens.AsNoTracking().ComDetalhes().FirstAsync(item => item.Id == nota.Id, cancellationToken);
        var resposta = MensagemResposta.De(mensagem);
        await AvisarNotaAsync(empresaId, ticket, resposta, cancellationToken);
        return resposta;
    }

    public async Task<object> EncaminharAsync(string mensagemId, DadosDeEncaminhamento dados, CancellationToken cancellationToken)
    {
        var usuario = usuarioAtual.Exigir();
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var mensagem = await db.Mensagens.AsNoTracking().Include(item => item.Ticket).FirstOrDefaultAsync(item => item.Id == mensagemId, cancellationToken);
        if (mensagem is null || mensagem.Ticket?.EmpresaId != empresaId)
        {
            throw AppException.NotFound(ErroNaoEncontradaParaEncaminhar);
        }
        await tickets.ExigirNoEscopoAsync(mensagem.Ticket, cancellationToken);
        if (mensagem.Interna)
        {
            throw new AppException("ERR_CANNOT_FORWARD_INTERNAL_NOTE");
        }

        Ticket destino;
        if (dados.TicketDestinoId is { } ticketDestinoId)
        {
            destino = await tickets.CarregarAsync(ticketDestinoId, empresaId, cancellationToken);
        }
        else if (dados.ContatoDestinoId is { } contatoDestinoId)
        {
            var contato = await db.Contatos.AsNoTracking().FirstOrDefaultAsync(item => item.Id == contatoDestinoId && item.EmpresaId == empresaId, cancellationToken)
                          ?? throw AppException.NotFound(ContatoService.ErroNaoEncontrado);
            var existente = await db.Tickets.AsNoTracking().Where(ticket => ticket.ContatoId == contato.Id && ticket.EmpresaId == empresaId)
                .OrderByDescending(ticket => ticket.AtualizadoEm).FirstOrDefaultAsync(cancellationToken);
            destino = existente is not null && existente.Situacao is SituacoesDoTicket.Aberto or SituacoesDoTicket.Pendente
                ? await tickets.CarregarAsync(existente.Id, empresaId, cancellationToken)
                : await tickets.CriarParaContatoAsync(contato.Id, SituacoesDoTicket.Aberto, usuario.Id, null, false, null, empresaId, cancellationToken);
        }
        else
        {
            throw new AppException("ERR_FORWARD_NO_TARGET");
        }

        if (!string.IsNullOrEmpty(mensagem.ArquivoDeMidia))
        {
            var caminho = arquivos.CaminhoCompleto(mensagem.ArquivoDeMidia);
            if (!File.Exists(caminho))
            {
                logger.LogWarning("Forward: media {File} is no longer on disk; forwarding only the text", mensagem.ArquivoDeMidia);
                if (!string.IsNullOrEmpty(mensagem.Corpo))
                {
                    await envio.EnviarTextoAsync(destino, FormatadorDeMensagem.Formatar(mensagem.Corpo, destino.Contato), null, mensagem.Corpo, null, cancellationToken);
                }
                return new { ticketId = destino.Id };
            }

            var tipo = TiposPorExtensao.GetValueOrDefault(Path.GetExtension(caminho), "application/octet-stream");
            var legenda = mensagem.Corpo == Path.GetFileName(mensagem.ArquivoDeMidia) ? null : mensagem.Corpo;
            await envio.EnviarMidiaAsync(destino,
                new MidiaParaEnvio(mensagem.ArquivoDeMidia, tipo, Path.GetFileName(mensagem.ArquivoDeMidia), legenda,
                    mensagem.TipoDeMidia == "audio", mensagem.TipoDeMidia == "document", mensagem.TipoDeMidia == "sticker", mensagem.TipoDeMidia ?? tipo.Split('/')[0]),
                string.IsNullOrEmpty(mensagem.Corpo) ? mensagem.ArquivoDeMidia : mensagem.Corpo, null, cancellationToken);
            return new { ticketId = destino.Id };
        }

        if (string.IsNullOrEmpty(mensagem.Corpo))
        {
            throw new AppException("ERR_EMPTY_MESSAGE_TO_FORWARD");
        }

        await envio.EnviarTextoAsync(destino, FormatadorDeMensagem.Formatar(mensagem.Corpo, destino.Contato), null, mensagem.Corpo, null, cancellationToken);
        return new { ticketId = destino.Id };
    }

    public async Task<MensagemResposta> EditarAsync(string mensagemId, DadosDaMensagem dados, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dados.Corpo))
        {
            throw new AppException("ERR_EDIT_EMPTY_BODY");
        }

        var (mensagem, ticket) = await CarregarComTicketAsync(mensagemId, cancellationToken);
        if (mensagem.Interna) throw new AppException("ERR_EDIT_INTERNAL_NOTE");
        if (!mensagem.DeMim) throw new AppException("ERR_EDIT_ONLY_OWN_MESSAGE");
        if (mensagem.Excluida) throw new AppException("ERR_EDIT_DELETED_MESSAGE");
        if (!string.IsNullOrEmpty(mensagem.ArquivoDeMidia)) throw new AppException("ERR_EDIT_MEDIA_MESSAGE");

        var corpo = dados.Corpo.Trim();
        await ComandoNoWhatsappAsync(() => gateway.EditMessageAsync(Sessao(ticket), mensagem.Id, EnvioPeloWhatsapp.ChatId(ticket), corpo, cancellationToken));
        mensagem.Corpo = corpo;
        mensagem.Editada = true;
        await db.SaveChangesAsync(cancellationToken);
        await registro.AvisarAtualizacaoAsync(mensagem.Id, cancellationToken);
        return MensagemResposta.De(await db.Mensagens.AsNoTracking().ComDetalhes().FirstAsync(item => item.Id == mensagem.Id, cancellationToken));
    }

    public async Task ExcluirAsync(string mensagemId, CancellationToken cancellationToken)
    {
        var (mensagem, ticket) = await CarregarComTicketAsync(mensagemId, cancellationToken);
        await ComandoNoWhatsappAsync(() => gateway.DeleteMessageAsync(Sessao(ticket), mensagem.Id, EnvioPeloWhatsapp.ChatId(ticket), mensagem.DeMim, cancellationToken));
        mensagem.Excluida = true;
        await db.SaveChangesAsync(cancellationToken);
        await registro.AvisarAtualizacaoAsync(mensagem.Id, cancellationToken);
    }

    private async Task<(Mensagem Mensagem, Ticket Ticket)> CarregarComTicketAsync(string mensagemId, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var mensagem = await db.Mensagens.Include(item => item.Ticket!).ThenInclude(ticket => ticket.Contato)
            .FirstOrDefaultAsync(item => item.Id == mensagemId, cancellationToken);
        if (mensagem?.Ticket is null || mensagem.Ticket.EmpresaId != empresaId)
        {
            throw new AppException(ErroNaoEncontrada);
        }
        await tickets.ExigirNoEscopoAsync(mensagem.Ticket, cancellationToken);

        return (mensagem, mensagem.Ticket);
    }

    private static string Sessao(Ticket ticket) =>
        ticket.ConexaoWhatsappId?.ToString(CultureInfo.InvariantCulture) ?? throw new AppException(EnvioPeloWhatsapp.ErroSemConexao);

    private static async Task ComandoNoWhatsappAsync(Func<Task> comando)
    {
        try
        {
            await comando();
        }
        catch (Exception exception) when (exception is GatewaySessionUnavailableException or HttpRequestException)
        {
            throw new AppException(EnvioPeloWhatsapp.ErroAoEnviar);
        }
    }

    private Task AvisarNotaAsync(int empresaId, Ticket ticket, MensagemResposta resposta, CancellationToken cancellationToken) =>
        realtime.ToRoomsAsync([RealtimeRooms.Company(empresaId), RealtimeRooms.Ticket(empresaId, ticket.Id)], "appMessage",
            new { action = "create", message = resposta, ticket = TicketResposta.De(ticket, comCamposDoContato: true), contact = ticket.Contato is { } contato ? ContatoResposta.De(contato) : null },
            cancellationToken);
}
