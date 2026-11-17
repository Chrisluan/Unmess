using System.Collections.Concurrent;
using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Unmess.Application.Atendimento;
using Unmess.Application.Common;
using Unmess.Application.Configuracoes;
using Unmess.Application.Contatos;
using Unmess.Application.Tickets;
using Unmess.Application.WhatsappGateway;
using Unmess.Domain.Contatos;
using Unmess.Domain.Conexoes;
using Unmess.Domain.Mensagens;
using Unmess.Domain.Tickets;

namespace Unmess.Application.Mensagens;

public sealed class RecebimentoDeMensagens(
    IUnmessDbContext db,
    RegistroDeContatos contatos,
    AberturaDeTickets abertura,
    TicketService tickets,
    RegistroDeMensagens registro,
    MensagensDoSistema sistema,
    LeitorDeConfiguracoes configuracoes,
    HorarioDeFuncionamento horario,
    ILogger<RecebimentoDeMensagens> logger)
{
    public async Task ProcessarAsync(int conexaoId, GatewayInboundMessage mensagem, CancellationToken cancellationToken)
    {
        var conexao = await db.ConexoesWhatsapp.AsNoTracking().Include(item => item.Filas).FirstOrDefaultAsync(item => item.Id == conexaoId, cancellationToken);
        if (conexao?.EmpresaId is not { } empresaId)
        {
            logger.LogWarning("Message {MessageId} arrived for unknown connection {WhatsappId}", mensagem.Id, conexaoId);
            return;
        }

        var contato = await contatos.CriarOuAtualizarAsync(mensagem.Sender, empresaId, cancellationToken, ehGrupo: mensagem.IsGroup && mensagem.FromMe);
        var contatoDoGrupo = mensagem.IsGroup && !mensagem.FromMe && mensagem.Group is { } grupo
            ? await contatos.CriarOuAtualizarAsync(grupo, empresaId, cancellationToken, ehGrupo: true)
            : null;

        var corpo = mensagem.Text ?? string.Empty;
        if (!string.IsNullOrEmpty(conexao.MensagemDeDespedida) && mensagem.FromMe &&
            FormatadorDeMensagem.Formatar(conexao.MensagemDeDespedida, contato) == corpo)
        {
            return;
        }

        var jaExiste = await db.Mensagens.AsNoTracking().AnyAsync(item => item.Id == mensagem.Id, cancellationToken);
        var ticket = await abertura.ObterOuCriarAsync(contato, conexaoId, mensagem.FromMe || jaExiste, contatoDoGrupo, cancellationToken);
        var tipo = TipoDaMensagem(mensagem.Kind);

        if (!mensagem.FromMe && ticket.MensagensNaoLidas == 1 && tipo != "vcard")
        {
            await EnviarForaDoHorarioAsync(empresaId, conexaoId, ticket, cancellationToken);
        }

        var dados = new Mensagem
        {
            Id = mensagem.Id,
            TicketId = ticket.Id,
            ContatoId = mensagem.FromMe ? null : contato.Id,
            Corpo = corpo,
            DeMim = mensagem.FromMe,
            Lida = mensagem.FromMe,
            TipoDeMidia = tipo,
            CitadaId = await CitadaConhecidaAsync(mensagem.QuotedMessageId, cancellationToken),
            Ack = mensagem.FromMe ? 1 : 0,
            DoAplicativo = mensagem.FromApp,
            Momento = DateTimeOffset.FromUnixTimeSeconds(mensagem.Timestamp > 100_000_000_000 ? mensagem.Timestamp / 1000 : mensagem.Timestamp)
        };
        if (mensagem.Media is { } midia)
        {
            dados.ArquivoDeMidia = midia.Ref;
            dados.Corpo = tipo == "sticker" ? corpo : string.IsNullOrEmpty(corpo) ? midia.Filename ?? midia.Ref : corpo;
            dados.TipoDeMidia = tipo == "sticker" ? "sticker" : midia.Mimetype.Split('/')[0];
        }

        var rastreado = await db.Tickets.FirstAsync(item => item.Id == ticket.Id, cancellationToken);
        rastreado.UltimaMensagem = tipo == "location"
            ? (corpo.Contains("Localization", StringComparison.Ordinal) ? corpo : "Localization")
            : string.IsNullOrEmpty(corpo) ? mensagem.Media?.Filename ?? string.Empty : corpo;
        rastreado.UltimaMensagemEm = dados.Momento;
        await registro.GravarAsync(dados, cancellationToken);

        if (tipo == "vcard")
        {
            await contatos.CriarDoVcardAsync(corpo, empresaId, cancellationToken);
        }

        var semFila = rastreado.FilaId is null;
        if (semFila && contatoDoGrupo is null && !mensagem.FromMe && rastreado.UsuarioId is null && conexao.Filas.Count >= 1)
        {
            await EscolherFilaAsync(conexao, corpo, ticket.Id, cancellationToken);
        }

        if (!mensagem.FromMe && contatoDoGrupo is null)
        {
            await sistema.SaudacaoDaFilaAsync(ticket.Id, cancellationToken);
        }
    }

    private async Task EnviarForaDoHorarioAsync(int empresaId, int conexaoId, Ticket ticket, CancellationToken cancellationToken)
    {
        if (await configuracoes.LerAsync("outOfHoursMessageEnabled", empresaId, string.Empty, cancellationToken) != "enabled" ||
            await horario.EstaAbertoAsync(empresaId, cancellationToken))
        {
            return;
        }

        var texto = await configuracoes.LerAsync("outOfHoursMessage", empresaId, string.Empty, cancellationToken);
        if (!string.IsNullOrEmpty(texto))
        {
            var completo = await tickets.CarregarAsync(ticket.Id, null, cancellationToken);
            await sistema.EnviarAsync(conexaoId, EnvioPeloWhatsapp.ChatId(completo), FormatadorDeMensagem.Formatar($"‎{texto}", completo), cancellationToken);
        }
    }

    private async Task EscolherFilaAsync(ConexaoWhatsapp conexao, string corpo, int ticketId, CancellationToken cancellationToken)
    {
        var filas = conexao.Filas.ToList();
        var escolhida = filas.Count == 1
            ? filas[0]
            : filas.FirstOrDefault(fila => fila.Padrao) ??
              (int.TryParse(corpo.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var opcao) && opcao >= 1 && opcao <= filas.Count ? filas[opcao - 1] : null);

        if (escolhida is not null)
        {
            await tickets.AtualizarAsync(ticketId, new DadosDoTicket { FilaId = System.Text.Json.JsonSerializer.SerializeToElement(escolhida.Id) }, null, false, cancellationToken);
            return;
        }

        var opcoes = new StringBuilder();
        for (var indice = 0; indice < filas.Count; indice++)
        {
            opcoes.Append(CultureInfo.InvariantCulture, $"*{indice + 1}* - {filas[indice].Nome}\n");
        }

        var ticket = await tickets.CarregarAsync(ticketId, null, cancellationToken);
        var texto = FormatadorDeMensagem.Formatar($"‎{conexao.MensagemDeSaudacao}\n{opcoes}", ticket.Contato);
        sistema.EnviarComAtraso(ticketId, conexao.Id, $"{ticket.Contato?.Numero}@c.us", texto);
    }

    private async Task<string?> CitadaConhecidaAsync(string? citadaId, CancellationToken cancellationToken) =>
        string.IsNullOrEmpty(citadaId) || !await db.Mensagens.AnyAsync(item => item.Id == citadaId, cancellationToken) ? null : citadaId;

    private static string TipoDaMensagem(string tipoDoGateway) => tipoDoGateway switch
    {
        "text" => "chat",
        "voice" => "ptt",
        "contact" => "vcard",
        "unknown" => "chat",
        _ => tipoDoGateway
    };
}

public sealed class MensagensDoSistema(
    IUnmessDbContext db,
    IWhatsappGateway gateway,
    IServiceScopeFactory scopeFactory,
    ILogger<MensagensDoSistema> logger)
{
    private static readonly ConcurrentDictionary<int, CancellationTokenSource> Pendentes = new();
    public static TimeSpan AtrasoDasOpcoes { get; set; } = TimeSpan.FromSeconds(3);

    public async Task EnviarAsync(int conexaoId, string chatId, string texto, CancellationToken cancellationToken)
    {
        try
        {
            await gateway.SendAsync(conexaoId.ToString(CultureInfo.InvariantCulture), new GatewaySendCommand(chatId, texto), cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or GatewaySessionUnavailableException)
        {
            logger.LogError(exception, "Error sending system message to {ChatId}", chatId);
        }
    }

    public void EnviarComAtraso(int ticketId, int conexaoId, string chatId, string texto)
    {
        var cancelamento = new CancellationTokenSource();
        Pendentes.AddOrUpdate(ticketId, cancelamento, (_, anterior) =>
        {
            anterior.Cancel();
            return cancelamento;
        });

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(AtrasoDasOpcoes, cancelamento.Token);
                Pendentes.TryRemove(new KeyValuePair<int, CancellationTokenSource>(ticketId, cancelamento));
                await using var scope = scopeFactory.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<MensagensDoSistema>().EnviarAsync(conexaoId, chatId, texto, CancellationToken.None);
            }
            catch (OperationCanceledException)
            {
            }
            finally
            {
                cancelamento.Dispose();
            }
        });
    }

    public async Task SaudacaoDaFilaAsync(int ticketId, CancellationToken cancellationToken)
    {
        var ticket = await db.Tickets.Include(item => item.Fila).Include(item => item.Contato).Include(item => item.Usuario)
            .FirstOrDefaultAsync(item => item.Id == ticketId, cancellationToken);
        if (ticket is null || ticket.SaudacaoEnviada || ticket.Fila is null || ticket.ConexaoWhatsappId is not { } conexaoId)
        {
            return;
        }

        var saudacao = ticket.Fila.MensagemDeSaudacao?.Trim();
        ticket.SaudacaoEnviada = true;
        await db.SaveChangesAsync(cancellationToken);
        if (!string.IsNullOrEmpty(saudacao))
        {
            await EnviarAsync(conexaoId, EnvioPeloWhatsapp.ChatId(ticket), FormatadorDeMensagem.Formatar($"‎{saudacao}", ticket), cancellationToken);
        }
    }
}

public sealed class HorarioDeFuncionamento(IUnmessDbContext db, TimeProvider timeProvider)
{
    public static TimeSpan Fuso { get; set; } = TimeSpan.FromHours(-3);

    public async Task<bool> EstaAbertoAsync(int empresaId, CancellationToken cancellationToken)
    {
        var horarios = await db.HorariosDeAtendimento.AsNoTracking().Where(item => item.EmpresaId == empresaId).ToListAsync(cancellationToken);
        if (horarios.Count == 0)
        {
            return true;
        }

        var agora = timeProvider.GetUtcNow().ToOffset(Fuso);
        var hoje = DateOnly.FromDateTime(agora.DateTime);
        var feriados = await db.Feriados.AsNoTracking().Where(item => item.EmpresaId == empresaId).ToListAsync(cancellationToken);
        if (feriados.Any(feriado => feriado.Recorrente ? feriado.Data.Month == hoje.Month && feriado.Data.Day == hoje.Day : feriado.Data == hoje))
        {
            return false;
        }

        var dia = horarios.FirstOrDefault(item => item.DiaDaSemana == (int)agora.DayOfWeek);
        if (dia is null || !dia.Ativo || !TimeOnly.TryParse(dia.Inicio, CultureInfo.InvariantCulture, out var inicio) || !TimeOnly.TryParse(dia.Fim, CultureInfo.InvariantCulture, out var fim))
        {
            return false;
        }

        var hora = TimeOnly.FromDateTime(agora.DateTime);
        return hora >= inicio && hora <= fim;
    }
}
