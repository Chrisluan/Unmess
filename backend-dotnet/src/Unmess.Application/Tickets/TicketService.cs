using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Unmess.Application.Common;
using Unmess.Application.Conexoes;
using Unmess.Application.Configuracoes;
using Unmess.Application.Mensagens;
using Unmess.Application.Permissoes;
using Unmess.Application.Usuarios;
using Unmess.Domain.Tickets;

namespace Unmess.Application.Tickets;

public sealed record FiltrosDeTickets
{
    public string? SearchParam { get; init; }
    public string? PageNumber { get; init; }
    public string? Status { get; init; }
    public string? Tab { get; init; }
    public string? Date { get; init; }
    public string? ShowAll { get; init; }
    public string? WithUnreadMessages { get; init; }
    public string? QueueIds { get; init; }
    public string? WhatsappIds { get; init; }
    public string? TagIds { get; init; }
    public string? UserIds { get; init; }
    public string? Groups { get; init; }
}

public sealed record ListaDeTickets(
    [property: JsonPropertyName("tickets")] IReadOnlyList<TicketResposta> Tickets,
    [property: JsonPropertyName("count")] int Total,
    [property: JsonPropertyName("hasMore")] bool TemMais);

public sealed record DadosDoTicket
{
    [JsonPropertyName("contactId")] public int? ContatoId { get; init; }
    [JsonPropertyName("status")] public string? Situacao { get; init; }
    [JsonPropertyName("queueId")] public JsonElement FilaId { get; init; }
    [JsonPropertyName("userId")] public JsonElement UsuarioId { get; init; }
    [JsonPropertyName("whatsappId")] public int? ConexaoWhatsappId { get; init; }
    [JsonPropertyName("closingStatusId")] public int? SituacaoDeEncerramentoId { get; init; }
    [JsonPropertyName("removeUser")] public bool? RemoverUsuario { get; init; }
    [JsonPropertyName("removeQueue")] public bool? RemoverFila { get; init; }
    [JsonPropertyName("isTransfer")] public bool? EhTransferencia { get; init; }
}

public sealed record DadosDasEtiquetasDoTicket
{
    [JsonPropertyName("tagIds")] public List<int>? EtiquetaIds { get; init; }
}

public sealed partial class TicketService(
    IUnmessDbContext db,
    IUsuarioAtual usuarioAtual,
    ResolvedorDePermissoes permissoes,
    ResolvedorDeEscopos escopos,
    SeletorDeConexao seletorDeConexao,
    LeitorDeConfiguracoes configuracoes,
    EnvioPeloWhatsapp envio,
    IRealtimePublisher realtime,
    TimeProvider timeProvider,
    ILogger<TicketService> logger)
{
    public const string ErroNaoEncontrado = "ERR_NO_TICKET_FOUND";
    public const string ErroOutroTicketAberto = "ERR_OTHER_OPEN_TICKET";
    public const string ErroSituacaoDeEncerramento = "ERR_CLOSING_STATUS_REQUIRED";
    public const string ErroEtiquetaInvalida = "ERR_INVALID_TAG";
    public const int TamanhoDaPagina = 40;

    [GeneratedRegex(@"[\s.\-/#]")]
    private static partial Regex SeparadoresDoProtocolo();

    public async Task<ListaDeTickets> ListarAsync(FiltrosDeTickets filtros, CancellationToken cancellationToken)
    {
        var usuario = usuarioAtual.Exigir();
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var usuarioId = usuario.Id;
        var filas = Lista(filtros.QueueIds);
        var conexoes = Lista(filtros.WhatsappIds);
        var etiquetas = Lista(filtros.TagIds);
        var atendentes = !string.IsNullOrEmpty(filtros.UserIds) && await permissoes.PossuiAsync(usuarioId, "tickets:viewAll", cancellationToken)
            ? Lista(filtros.UserIds)
            : [];

        var consulta = db.Tickets.AsNoTracking().Where(ticket => ticket.EmpresaId == empresaId);
        var regra = filtros.Tab is not null ? RegrasDasAbas.Todas.GetValueOrDefault(filtros.Tab) : null;
        var filtroPorUsuario = filtros.ShowAll != "true" && regra is null;

        if (regra is not null)
        {
            var situacoes = regra.Situacoes.ToList();
            consulta = consulta.Where(ticket => situacoes.Contains(ticket.Situacao));
            consulta = regra.Atendente switch
            {
                "me" => consulta.Where(ticket => ticket.UsuarioId == usuarioId),
                "none" => consulta.Where(ticket => ticket.UsuarioId == null),
                "other" => consulta.Where(ticket => ticket.UsuarioId != null && ticket.UsuarioId != usuarioId),
                _ => consulta
            };
            consulta = regra.Setor switch
            {
                "mine" => consulta.Where(ticket => ticket.FilaId != null && filas.Contains(ticket.FilaId.Value)),
                "mineOrNone" => consulta.Where(ticket => ticket.FilaId == null || filas.Contains(ticket.FilaId.Value)),
                _ => consulta
            };
            if (regra.EhGrupo is { } ehGrupo)
            {
                consulta = consulta.Where(ticket => ticket.EhGrupo == ehGrupo);
            }
            if (regra.ContatoConhecido is { } conhecido)
            {
                consulta = consulta.Where(ticket => ticket.Contato != null && ticket.Contato.Conhecido == conhecido);
            }
        }
        else
        {
            consulta = consulta.Where(ticket => ticket.FilaId == null || filas.Contains(ticket.FilaId.Value));
            if (!string.IsNullOrEmpty(filtros.Status))
            {
                consulta = consulta.Where(ticket => ticket.Situacao == filtros.Status);
            }
        }

        if (!string.IsNullOrEmpty(filtros.SearchParam))
        {
            filtroPorUsuario = false;
            var termo = filtros.SearchParam.ToLowerInvariant().Trim();
            var padrao = $"%{termo}%";
            var protocolo = SeparadoresDoProtocolo().Replace(termo, string.Empty);
            var buscarProtocolo = protocolo.Length >= 4 && protocolo.All(char.IsAsciiDigit);
            var padraoDoProtocolo = $"%{protocolo}%";
            consulta = consulta.Where(ticket =>
                db.Contatos.Any(contato => contato.Id == ticket.ContatoId && contato.EmpresaId == empresaId &&
                                           (EF.Functions.Like(contato.Nome.ToLower(), padrao) || EF.Functions.Like(contato.Numero, padrao))) ||
                db.Mensagens.Any(mensagem => mensagem.TicketId == ticket.Id && EF.Functions.Like(mensagem.Corpo.ToLower(), padrao)) ||
                (buscarProtocolo && EF.Functions.Like(ticket.Protocolo, padraoDoProtocolo)));
        }

        if (filtroPorUsuario)
        {
            consulta = consulta.Where(ticket => ticket.UsuarioId == usuarioId || ticket.Situacao == SituacoesDoTicket.Pendente);
        }

        if (!string.IsNullOrEmpty(filtros.Date) && DateOnly.TryParse(filtros.Date[..Math.Min(10, filtros.Date.Length)], CultureInfo.InvariantCulture, out var dia))
        {
            var deslocamento = TimeSpan.FromHours(-3);
            var inicio = new DateTimeOffset(dia.ToDateTime(TimeOnly.MinValue), deslocamento);
            var fim = new DateTimeOffset(dia.ToDateTime(TimeOnly.MaxValue), deslocamento);
            consulta = db.Tickets.AsNoTracking().Where(ticket => ticket.EmpresaId == empresaId && ticket.CriadoEm >= inicio && ticket.CriadoEm <= fim);
        }

        if (filtros.WithUnreadMessages == "true")
        {
            var filasDoUsuario = await db.Usuarios.Where(item => item.Id == usuarioId).SelectMany(item => item.Filas.Select(fila => fila.Id)).ToListAsync(cancellationToken);
            consulta = db.Tickets.AsNoTracking().Where(ticket => ticket.EmpresaId == empresaId &&
                (ticket.UsuarioId == usuarioId || ticket.Situacao == SituacoesDoTicket.Pendente) &&
                (ticket.FilaId == null || filasDoUsuario.Contains(ticket.FilaId.Value)) &&
                ticket.MensagensNaoLidas > 0);
        }

        // O filtro da pessoa so restringe: a intersecao com o escopo vem sempre.
        var escopoDeConexoes = await escopos.ResolverAsync(usuarioId, Escopos.Conexao, cancellationToken);
        if (conexoes.Count > 0)
        {
            var permitidas = conexoes.Where(id => escopoDeConexoes.Alcanca(id)).ToList();
            consulta = consulta.Where(ticket => ticket.ConexaoWhatsappId != null && permitidas.Contains(ticket.ConexaoWhatsappId.Value));
        }
        else if (!escopoDeConexoes.SemRestricao)
        {
            // Ticket sem conexao registrada continua passando, como no backend Node.
            var negados = escopoDeConexoes.Negados.ToList();
            var ids = escopoDeConexoes.Ids.ToList();
            consulta = escopoDeConexoes.Irrestrito
                ? consulta.Where(ticket => ticket.ConexaoWhatsappId == null || !negados.Contains(ticket.ConexaoWhatsappId.Value))
                : consulta.Where(ticket => ticket.ConexaoWhatsappId == null || ids.Contains(ticket.ConexaoWhatsappId.Value));
        }
        if (atendentes.Count > 0)
        {
            consulta = consulta.Where(ticket => ticket.UsuarioId != null && atendentes.Contains(ticket.UsuarioId.Value));
        }
        if (etiquetas.Count > 0)
        {
            consulta = consulta.Where(ticket => ticket.Etiquetas.Any(etiqueta => etiquetas.Contains(etiqueta.Id)));
        }
        consulta = filtros.Groups switch
        {
            "only" => consulta.Where(ticket => ticket.EhGrupo),
            "exclude" => consulta.Where(ticket => !ticket.EhGrupo),
            _ => consulta
        };

        var total = await consulta.CountAsync(cancellationToken);
        var pagina = Math.Max(1, int.TryParse(filtros.PageNumber, out var numero) ? numero : 1);
        var tickets = await consulta.ComDetalhes()
            .OrderByDescending(ticket => ticket.AtualizadoEm)
            .Skip(TamanhoDaPagina * (pagina - 1))
            .Take(TamanhoDaPagina)
            .ToListAsync(cancellationToken);

        return new ListaDeTickets(tickets.Select(ticket => TicketResposta.De(ticket)).ToList(), total, total > TamanhoDaPagina * (pagina - 1) + tickets.Count);
    }

    public async Task<TicketResposta> MostrarAsync(int id, CancellationToken cancellationToken) =>
        TicketResposta.De(await CarregarAsync(id, usuarioAtual.EmpresaIdObrigatoria(), cancellationToken), comCamposDoContato: true);

    public async Task<Ticket> CarregarAsync(int id, int? empresaId, CancellationToken cancellationToken)
    {
        var ticket = await db.Tickets.ComDetalhes(comCamposDoContato: true)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw AppException.NotFound(ErroNaoEncontrado);
        if (empresaId is not null && ticket.EmpresaId != empresaId)
        {
            throw AppException.NotFound(ErroNaoEncontrado);
        }

        // Chamadas internas (webhook, empresaId nulo) nao sao feitas em nome de ninguem.
        if (empresaId is not null)
        {
            await ExigirNoEscopoAsync(ticket, cancellationToken);
        }

        await GarantirProtocoloAsync(ticket, cancellationToken);
        return ticket;
    }

    /// <summary>
    /// Confere se o usuario atual alcanca a conexao do ticket. Fora do escopo responde 404, igual a
    /// "nao existe", para nao revelar ids de outras conexoes. Sem usuario autenticado nao faz nada.
    /// </summary>
    public async Task ExigirNoEscopoAsync(Ticket ticket, CancellationToken cancellationToken)
    {
        if (usuarioAtual.Obter() is not { } solicitante)
        {
            return;
        }

        var escopoDeConexoes = await escopos.ResolverAsync(solicitante.Id, Escopos.Conexao, cancellationToken);
        if (!escopoDeConexoes.Alcanca(ticket.ConexaoWhatsappId))
        {
            throw AppException.NotFound(ErroNaoEncontrado);
        }
    }

    public async Task<TicketResposta> CriarAsync(DadosDoTicket dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var usuarioId = Inteiro(dados.UsuarioId);
        var ticket = await CriarParaContatoAsync(dados.ContatoId ?? 0, dados.Situacao ?? SituacoesDoTicket.Pendente, usuarioId, Inteiro(dados.FilaId),
            dados.FilaId.ValueKind != JsonValueKind.Undefined, dados.ConexaoWhatsappId, empresaId, cancellationToken);
        var resposta = TicketResposta.De(ticket);
        await realtime.ToRoomsAsync([RealtimeRooms.Company(empresaId), RealtimeRooms.Status(empresaId, ticket.Situacao)], "ticket",
            new { action = "update", ticket = resposta }, cancellationToken);
        return resposta;
    }

    public async Task<Ticket> CriarParaContatoAsync(int contatoId, string situacao, int? usuarioId, int? filaId, bool filaInformada, int? conexaoId, int empresaId, CancellationToken cancellationToken)
    {
        var conexao = await seletorDeConexao.PadraoAsync(empresaId, usuarioId, conexaoId, cancellationToken);
        await ExigirSemOutroAbertoAsync(contatoId, conexao.Id, cancellationToken);
        var contato = await db.Contatos.AsNoTracking().FirstOrDefaultAsync(item => item.Id == contatoId && item.EmpresaId == empresaId, cancellationToken)
                      ?? throw AppException.NotFound("ERR_NO_CONTACT_FOUND");

        if (!filaInformada && usuarioId is not null)
        {
            var filasDoUsuario = await db.Usuarios.Where(item => item.Id == usuarioId).SelectMany(item => item.Filas.Select(fila => fila.Id)).ToListAsync(cancellationToken);
            filaId = filasDoUsuario.Count == 1 ? filasDoUsuario[0] : null;
        }

        var ticket = new Ticket
        {
            ContatoId = contatoId,
            Situacao = situacao,
            EhGrupo = contato.EhGrupo,
            UsuarioId = usuarioId,
            FilaId = filaId,
            EmpresaId = empresaId,
            ConexaoWhatsappId = conexao.Id
        };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync(cancellationToken);
        return await CarregarAsync(ticket.Id, null, cancellationToken);
    }

    public async Task<TicketResposta> AtualizarPelaRotaAsync(int id, DadosDoTicket dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var ticket = await AtualizarAsync(id, dados, empresaId, dados.EhTransferencia == true, cancellationToken);
        if (ticket.Situacao == SituacoesDoTicket.Encerrado && ticket.ConexaoWhatsappId is { } conexaoId)
        {
            var despedida = await db.ConexoesWhatsapp.AsNoTracking().Where(conexao => conexao.Id == conexaoId)
                .Select(conexao => conexao.MensagemDeDespedida).FirstOrDefaultAsync(cancellationToken);
            if (!string.IsNullOrEmpty(despedida))
            {
                var texto = FormatadorDeMensagem.Formatar(despedida, ticket.Contato);
                await envio.EnviarTextoAsync(ticket, texto, null, texto, null, cancellationToken);
            }
        }

        return TicketResposta.De(ticket, comCamposDoContato: true);
    }

    public async Task<Ticket> AtualizarAsync(int id, DadosDoTicket dados, int? empresaId, bool ehTransferencia, CancellationToken cancellationToken)
    {
        var usuarioInformado = dados.UsuarioId.ValueKind != JsonValueKind.Undefined;
        var usuarioId = Inteiro(dados.UsuarioId);
        var filaInformada = dados.FilaId.ValueKind != JsonValueKind.Undefined;
        var filaId = Inteiro(dados.FilaId);
        if (dados.RemoverUsuario == true)
        {
            usuarioInformado = true;
            usuarioId = null;
        }
        if (dados.RemoverFila == true)
        {
            filaInformada = true;
            filaId = null;
        }

        var ticket = await CarregarAsync(id, empresaId, cancellationToken);
        await MarcarMensagensComoLidasAsync(ticket, cancellationToken);

        if (dados.ConexaoWhatsappId is { } novaConexao && ticket.ConexaoWhatsappId != novaConexao)
        {
            await ExigirSemOutroAbertoAsync(ticket.ContatoId ?? 0, novaConexao, cancellationToken);
        }

        var situacaoAnterior = ticket.Situacao;
        var usuarioAnterior = ticket.Usuario?.Id;
        var filaAnterior = ticket.FilaId;
        if (situacaoAnterior == SituacoesDoTicket.Encerrado)
        {
            await ExigirSemOutroAbertoAsync(ticket.ContatoId ?? 0, ticket.ConexaoWhatsappId ?? 0, cancellationToken);
        }

        if (dados.Situacao == SituacoesDoTicket.Encerrado && situacaoAnterior != SituacoesDoTicket.Encerrado && ticket.EmpresaId is { } empresaDoTicket)
        {
            var exigeSituacao = await configuracoes.LerBooleanoAsync("requireClosingStatus", empresaDoTicket, false, cancellationToken);
            var situacaoResultante = dados.SituacaoDeEncerramentoId ?? ticket.SituacaoDeEncerramentoId;
            if (exigeSituacao && situacaoResultante is null)
            {
                throw new AppException(ErroSituacaoDeEncerramento);
            }
        }

        var filaResultante = filaInformada ? filaId : filaAnterior;
        if (filaResultante is null && empresaId is not null)
        {
            var padrao = await db.Filas.AsNoTracking().Where(fila => fila.Padrao && fila.EmpresaId == empresaId).Select(fila => (int?)fila.Id).FirstOrDefaultAsync(cancellationToken);
            if (padrao is not null)
            {
                filaInformada = true;
                filaId = padrao;
            }
        }

        var agora = timeProvider.GetUtcNow();
        if (dados.Situacao is not null) ticket.Situacao = dados.Situacao;
        if (dados.SituacaoDeEncerramentoId is not null) ticket.SituacaoDeEncerramentoId = dados.SituacaoDeEncerramentoId;
        var definirPrimeiraResposta = usuarioId is not null && ticket.PrimeiraRespostaEm is null;
        if (usuarioInformado) ticket.UsuarioId = usuarioId;
        if (filaInformada) ticket.FilaId = filaId;

        var contatoConhecido = ticket.Contato?.Conhecido == true;
        if (contatoConhecido)
        {
            ticket.UsuarioId = null;
            definirPrimeiraResposta = false;
        }
        if (definirPrimeiraResposta)
        {
            ticket.PrimeiraRespostaEm = agora;
        }

        if (dados.Situacao == SituacoesDoTicket.Encerrado && situacaoAnterior != SituacoesDoTicket.Encerrado)
        {
            ticket.EncerradoEm = agora;
            ticket.UsuarioId = null;
            ticket.FilaId = null;
        }
        if (dados.ConexaoWhatsappId is { } conexaoId)
        {
            ticket.ConexaoWhatsappId = conexaoId;
        }

        await db.SaveChangesAsync(cancellationToken);
        ticket = await CarregarAsync(ticket.Id, null, cancellationToken);

        var transferido = ehTransferencia && ((usuarioInformado || contatoConhecido) && ticket.UsuarioId != usuarioAnterior || filaInformada && ticket.FilaId != filaAnterior);
        if (transferido && ticket.EmpresaId is { } empresaParaTransferencia)
        {
            try
            {
                if (await configuracoes.LerAsync("transferMessageEnabled", empresaParaTransferencia, string.Empty, cancellationToken) == "enabled")
                {
                    var mensagem = await configuracoes.LerAsync("transferMessage", empresaParaTransferencia, string.Empty, cancellationToken);
                    if (!string.IsNullOrEmpty(mensagem))
                    {
                        var texto = FormatadorDeMensagem.Formatar(mensagem, ticket);
                        await envio.EnviarTextoAsync(ticket, texto, null, texto, null, cancellationToken);
                    }
                }
            }
            catch (AppException exception)
            {
                logger.LogError(exception, "Error sending transfer message");
            }
        }

        await AvisarAtualizacaoAsync(ticket, situacaoAnterior, usuarioAnterior, cancellationToken);
        return ticket;
    }

    public async Task AvisarAtualizacaoAsync(Ticket ticket, string situacaoAnterior, int? usuarioAnterior, CancellationToken cancellationToken)
    {
        var empresaId = ticket.EmpresaId ?? 0;
        if (ticket.Situacao != situacaoAnterior || ticket.Usuario?.Id != usuarioAnterior)
        {
            await realtime.ToRoomsAsync([RealtimeRooms.Company(empresaId), RealtimeRooms.Status(empresaId, situacaoAnterior)], "ticket",
                new { action = "delete", ticketId = ticket.Id }, cancellationToken);
        }

        await realtime.ToRoomsAsync(
            [RealtimeRooms.Company(empresaId), RealtimeRooms.Status(empresaId, ticket.Situacao), RealtimeRooms.Notification(empresaId), RealtimeRooms.Ticket(empresaId, ticket.Id)],
            "ticket", new { action = "update", ticket = TicketResposta.De(ticket, comCamposDoContato: true) }, cancellationToken);
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var ticket = await db.Tickets.FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
                     ?? throw AppException.NotFound(ErroNaoEncontrado);
        await ExigirNoEscopoAsync(ticket, cancellationToken);
        db.Tickets.Remove(ticket);
        await db.SaveChangesAsync(cancellationToken);
        await realtime.ToRoomsAsync(
            [RealtimeRooms.Company(empresaId), RealtimeRooms.Status(empresaId, ticket.Situacao), RealtimeRooms.Ticket(empresaId, id), RealtimeRooms.Notification(empresaId)],
            "ticket", new { action = "delete", ticketId = id }, cancellationToken);
    }

    public async Task<TicketResposta> SincronizarEtiquetasAsync(int id, DadosDasEtiquetasDoTicket dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var ids = dados.EtiquetaIds ?? [];
        await CarregarAsync(id, empresaId, cancellationToken);
        var validas = await db.Etiquetas.Where(etiqueta => ids.Contains(etiqueta.Id) && etiqueta.EmpresaId == empresaId).ToListAsync(cancellationToken);
        if (validas.Count != ids.Count)
        {
            throw new AppException(ErroEtiquetaInvalida);
        }

        var ticket = await db.Tickets.Include(item => item.Etiquetas).FirstAsync(item => item.Id == id, cancellationToken);
        ticket.Etiquetas.Clear();
        ticket.Etiquetas.AddRange(validas);
        await db.SaveChangesAsync(cancellationToken);

        var resposta = TicketResposta.De(await CarregarAsync(id, empresaId, cancellationToken), comCamposDoContato: true);
        await realtime.ToRoomsAsync(
            [RealtimeRooms.Company(empresaId), RealtimeRooms.Status(empresaId, resposta.Situacao), RealtimeRooms.Ticket(empresaId, id)],
            "ticket", new { action = "update", ticket = resposta }, cancellationToken);
        return resposta;
    }

    public async Task MarcarMensagensComoLidasAsync(Ticket ticket, CancellationToken cancellationToken)
    {
        await db.Mensagens.Where(mensagem => mensagem.TicketId == ticket.Id && !mensagem.Lida)
            .ExecuteUpdateAsync(setters => setters.SetProperty(mensagem => mensagem.Lida, true), cancellationToken);
        ticket.MensagensNaoLidas = 0;
        await db.SaveChangesAsync(cancellationToken);
        await envio.MarcarComoLidasAsync(ticket, cancellationToken);

        var empresaId = ticket.EmpresaId ?? 0;
        await realtime.ToRoomsAsync([RealtimeRooms.Status(empresaId, ticket.Situacao), RealtimeRooms.Notification(empresaId)], "ticket",
            new { action = "updateUnread", ticketId = ticket.Id }, cancellationToken);
    }

    public async Task GarantirProtocoloAsync(Ticket ticket, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrEmpty(ticket.Protocolo))
        {
            return;
        }

        var local = ticket.CriadoEm.ToOffset(TimeSpan.FromHours(-3));
        ticket.Protocolo = string.Create(CultureInfo.InvariantCulture, $"{local:yyyyMMdd}{ticket.Id:D6}");
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            logger.LogError(exception, "Error setting protocol for ticket {TicketId}", ticket.Id);
        }
    }

    private async Task ExigirSemOutroAbertoAsync(int contatoId, int conexaoId, CancellationToken cancellationToken)
    {
        if (await db.Tickets.AnyAsync(ticket => ticket.ContatoId == contatoId && ticket.ConexaoWhatsappId == conexaoId &&
                                                (ticket.Situacao == SituacoesDoTicket.Aberto || ticket.Situacao == SituacoesDoTicket.Pendente), cancellationToken))
        {
            throw new AppException(ErroOutroTicketAberto);
        }
    }

    private static List<int> Lista(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<JsonElement>>(json)?
                .Select(item => item.ValueKind == JsonValueKind.Number ? item.GetInt32() : int.TryParse(item.GetString(), out var valor) ? valor : 0)
                .Where(valor => valor != 0)
                .ToList() ?? [];
        }
        catch (JsonException)
        {
            throw new AppException("Invalid filter");
        }
    }

    private static int? Inteiro(JsonElement valor) => valor switch
    {
        { ValueKind: JsonValueKind.Number } numero => numero.GetInt32(),
        { ValueKind: JsonValueKind.String } texto when int.TryParse(texto.GetString(), out var convertido) => convertido,
        _ => null
    };
}

