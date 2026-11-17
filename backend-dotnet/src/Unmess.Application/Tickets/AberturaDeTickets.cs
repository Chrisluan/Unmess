using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Unmess.Application.Common;
using Unmess.Application.Configuracoes;
using Unmess.Domain.Contatos;
using Unmess.Domain.Tickets;

namespace Unmess.Application.Tickets;

public sealed class AberturaDeTickets(
    IUnmessDbContext db,
    TicketService tickets,
    LeitorDeConfiguracoes configuracoes,
    TimeProvider timeProvider,
    ILogger<AberturaDeTickets> logger)
{
    public async Task<Ticket> ObterOuCriarAsync(Contato contato, int conexaoId, bool semNovaNaoLida, Contato? contatoDoGrupo, CancellationToken cancellationToken)
    {
        var contatoDoTicket = contatoDoGrupo ?? contato;
        var empresaId = contatoDoTicket.EmpresaId ?? 0;

        var ticket = await db.Tickets.Where(item =>
                (item.Situacao == SituacoesDoTicket.Aberto || item.Situacao == SituacoesDoTicket.Pendente) &&
                item.ContatoId == contatoDoTicket.Id && item.ConexaoWhatsappId == conexaoId)
            .FirstOrDefaultAsync(cancellationToken);
        if (ticket is not null)
        {
            ticket.MensagensNaoLidas = NaoLidas(ticket, semNovaNaoLida);
        }

        if (ticket is null && contatoDoGrupo is not null)
        {
            ticket = await db.Tickets.Where(item => item.ContatoId == contatoDoGrupo.Id && item.ConexaoWhatsappId == conexaoId)
                .OrderByDescending(item => item.AtualizadoEm).FirstOrDefaultAsync(cancellationToken);
            if (ticket is not null)
            {
                ticket.Situacao = SituacoesDoTicket.Pendente;
                ticket.UsuarioId = null;
                ticket.MensagensNaoLidas = NaoLidas(ticket, semNovaNaoLida, reiniciar: true);
            }
        }

        if (ticket is null && contatoDoGrupo is null)
        {
            var janela = await configuracoes.LerNumeroAsync("reopenTicketWindowHours", empresaId, 2, cancellationToken);
            var agora = timeProvider.GetUtcNow();
            var limite = agora.AddHours(-janela);
            ticket = await db.Tickets.Where(item => item.AtualizadoEm >= limite && item.AtualizadoEm <= agora && item.ContatoId == contato.Id && item.ConexaoWhatsappId == conexaoId)
                .OrderByDescending(item => item.AtualizadoEm).FirstOrDefaultAsync(cancellationToken);
            if (ticket is not null)
            {
                ticket.Situacao = SituacoesDoTicket.Pendente;
                ticket.UsuarioId = null;
                ticket.MensagensNaoLidas = NaoLidas(ticket, semNovaNaoLida, reiniciar: true);
            }
        }

        var criado = false;
        if (ticket is null)
        {
            var filaPadrao = await db.Filas.AsNoTracking().Where(fila => fila.Padrao && fila.EmpresaId == empresaId).Select(fila => (int?)fila.Id).FirstOrDefaultAsync(cancellationToken);
            ticket = new Ticket
            {
                ContatoId = contatoDoTicket.Id,
                Situacao = contatoDoTicket.Conhecido ? SituacoesDoTicket.Aberto : SituacoesDoTicket.Pendente,
                EhGrupo = contatoDoGrupo is not null,
                MensagensNaoLidas = semNovaNaoLida ? 0 : 1,
                ConexaoWhatsappId = conexaoId,
                FilaId = filaPadrao,
                EmpresaId = empresaId
            };
            db.Tickets.Add(ticket);
            criado = true;
        }

        await db.SaveChangesAsync(cancellationToken);
        if (criado)
        {
            await tickets.GarantirProtocoloAsync(ticket, cancellationToken);
            if (!contatoDoTicket.Conhecido)
            {
                await AtribuirAutomaticamenteAsync(ticket, cancellationToken);
            }
        }

        return await tickets.CarregarAsync(ticket.Id, null, cancellationToken);
    }

    private static int NaoLidas(Ticket ticket, bool semNovaNaoLida, bool reiniciar = false) =>
        semNovaNaoLida ? (reiniciar ? 0 : ticket.MensagensNaoLidas ?? 0) : (reiniciar ? 0 : ticket.MensagensNaoLidas ?? 0) + 1;

    private async Task AtribuirAutomaticamenteAsync(Ticket ticket, CancellationToken cancellationToken)
    {
        if (ticket.UsuarioId is not null || ticket.EhGrupo || ticket.EmpresaId is not { } empresaId ||
            !await configuracoes.LerBooleanoAsync("autoAssignTickets", empresaId, false, cancellationToken))
        {
            return;
        }

        var candidatos = db.Usuarios.AsNoTracking().Where(usuario => usuario.EmpresaId == empresaId && usuario.Online);
        if (ticket.FilaId is { } filaId)
        {
            candidatos = candidatos.Where(usuario => usuario.Filas.Any(fila => fila.Id == filaId));
        }

        var pontuados = new List<(int UsuarioId, string Nome, int Abertos, DateTimeOffset UltimoEm)>();
        foreach (var usuario in await candidatos.ToListAsync(cancellationToken))
        {
            var abertos = await db.Tickets.CountAsync(item => item.UsuarioId == usuario.Id && item.EmpresaId == empresaId &&
                                                              (item.Situacao == SituacoesDoTicket.Aberto || item.Situacao == SituacoesDoTicket.Pendente), cancellationToken);
            if (usuario.MaximoDeTicketsSimultaneos > 0 && abertos >= usuario.MaximoDeTicketsSimultaneos)
            {
                continue;
            }

            var ultimo = await db.Tickets.Where(item => item.UsuarioId == usuario.Id && item.EmpresaId == empresaId)
                .OrderByDescending(item => item.AtualizadoEm).Select(item => (DateTimeOffset?)item.AtualizadoEm).FirstOrDefaultAsync(cancellationToken);
            pontuados.Add((usuario.Id, usuario.Nome, abertos, ultimo ?? DateTimeOffset.MinValue));
        }

        if (pontuados.Count == 0)
        {
            logger.LogInformation("AutoAssign: no available agent for ticket {TicketId}", ticket.Id);
            return;
        }

        var escolhido = pontuados.OrderBy(item => item.Abertos).ThenBy(item => item.UltimoEm).First();
        ticket.UsuarioId = escolhido.UsuarioId;
        ticket.Situacao = SituacoesDoTicket.Aberto;
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("AutoAssign: ticket {TicketId} assigned to {Agent} ({Open} open chats)", ticket.Id, escolhido.Nome, escolhido.Abertos);
    }
}
