using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Contatos;
using Unmess.Application.Tickets;
using Unmess.Domain.Mensagens;

namespace Unmess.Application.Mensagens;

public sealed class RegistroDeMensagens(IUnmessDbContext db, IRealtimePublisher realtime)
{
    public async Task<Mensagem> GravarAsync(Mensagem dados, CancellationToken cancellationToken)
    {
        var existente = await db.Mensagens.FirstOrDefaultAsync(mensagem => mensagem.Id == dados.Id, cancellationToken);
        if (existente is null)
        {
            db.Mensagens.Add(dados);
        }
        else
        {
            existente.Corpo = dados.Corpo;
            existente.Ack = Math.Max(existente.Ack, dados.Ack);
            existente.DeMim = dados.DeMim;
            existente.Lida = existente.Lida || dados.Lida;
            existente.TicketId = dados.TicketId;
            existente.ContatoId = dados.ContatoId ?? existente.ContatoId;
            existente.CitadaId = dados.CitadaId ?? existente.CitadaId;
            existente.TipoDeMidia = dados.TipoDeMidia ?? existente.TipoDeMidia;
            existente.ArquivoDeMidia = existente.ArquivoDeMidia ?? dados.ArquivoDeMidia;
            existente.Momento = dados.Momento ?? existente.Momento;
        }

        await db.SaveChangesAsync(cancellationToken);
        await AvisarCriacaoAsync(dados.Id, cancellationToken);
        return existente ?? dados;
    }

    public async Task AvisarCriacaoAsync(string mensagemId, CancellationToken cancellationToken)
    {
        var mensagem = await db.Mensagens.AsNoTracking().ComDetalhes().FirstAsync(item => item.Id == mensagemId, cancellationToken);
        var ticket = await db.Tickets.AsNoTracking().ComDetalhes().FirstAsync(item => item.Id == mensagem.TicketId, cancellationToken);
        var empresaId = ticket.EmpresaId ?? 0;

        await realtime.ToRoomsAsync(
            [
                RealtimeRooms.Company(empresaId),
                RealtimeRooms.Ticket(empresaId, ticket.Id),
                RealtimeRooms.Status(empresaId, ticket.Situacao),
                RealtimeRooms.Notification(empresaId)
            ],
            "appMessage",
            new
            {
                action = "create",
                message = MensagemResposta.De(mensagem),
                ticket = TicketResposta.De(ticket),
                contact = ticket.Contato is { } contato ? ContatoResposta.De(contato) : null
            },
            cancellationToken);
    }

    public async Task AvisarAtualizacaoAsync(string mensagemId, CancellationToken cancellationToken)
    {
        var mensagem = await db.Mensagens.AsNoTracking().ComDetalhes().Include(item => item.Ticket)
            .FirstOrDefaultAsync(item => item.Id == mensagemId, cancellationToken);
        if (mensagem?.Ticket?.EmpresaId is not { } empresaId)
        {
            return;
        }

        await realtime.ToRoomsAsync(
            [RealtimeRooms.Company(empresaId), RealtimeRooms.Ticket(empresaId, mensagem.TicketId)],
            "appMessage",
            new { action = "update", message = MensagemResposta.De(mensagem) },
            cancellationToken);
    }
}
