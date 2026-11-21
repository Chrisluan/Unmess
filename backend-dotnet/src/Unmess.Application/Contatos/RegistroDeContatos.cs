using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Unmess.Application.Common;
using Unmess.Application.WhatsappGateway;
using Unmess.Domain.Contatos;

namespace Unmess.Application.Contatos;

public sealed partial class RegistroDeContatos(IUnmessDbContext db, IRealtimePublisher realtime, ILogger<RegistroDeContatos> logger)
{
    [GeneratedRegex(@"\D")]
    private static partial Regex NaoDigitos();

    public async Task<Contato> CriarOuAtualizarAsync(GatewayParticipant participante, int empresaId, CancellationToken cancellationToken, bool ehGrupo = false)
    {
        var grupo = ehGrupo || participante.Jid.EndsWith("@g.us", StringComparison.Ordinal);
        var numero = grupo ? participante.Number : NaoDigitos().Replace(participante.Number, string.Empty);
        var lid = string.IsNullOrEmpty(participante.Lid) ? null : participante.Lid;
        if (string.IsNullOrEmpty(numero) && lid is null)
        {
            throw new InvalidOperationException("Either number or lid must be provided");
        }

        var porNumero = string.IsNullOrEmpty(numero) ? null
            : await db.Contatos.FirstOrDefaultAsync(contato => contato.Numero == numero && contato.EmpresaId == empresaId, cancellationToken);
        var porLid = lid is null ? null
            : await db.Contatos.FirstOrDefaultAsync(contato => contato.Lid == lid && contato.EmpresaId == empresaId, cancellationToken);

        Contato resultado;
        string acao;
        if (porNumero is not null && porLid is not null && porNumero.Id != porLid.Id)
        {
            await db.Tickets.Where(ticket => ticket.ContatoId == porLid.Id && ticket.EmpresaId == empresaId)
                .ExecuteUpdateAsync(setters => setters.SetProperty(ticket => ticket.ContatoId, porNumero.Id), cancellationToken);
            db.Contatos.Remove(porLid);
            porNumero.Lid = porLid.Lid;
            porNumero.FotoDePerfil = participante.ProfilePicUrl;
            logger.LogInformation("Merged contacts by number and lid: {Primary} absorbed {Merged}", porNumero.Id, porLid.Id);
            resultado = porNumero;
            acao = "update";
        }
        else if (porNumero is not null)
        {
            porNumero.Lid = lid ?? porNumero.Lid;
            porNumero.FotoDePerfil = participante.ProfilePicUrl;
            resultado = porNumero;
            acao = "update";
        }
        else if (porLid is not null)
        {
            porLid.Numero = string.IsNullOrEmpty(numero) ? porLid.Numero : numero;
            porLid.FotoDePerfil = participante.ProfilePicUrl;
            resultado = porLid;
            acao = "update";
        }
        else
        {
            resultado = new Contato
            {
                Nome = participante.Name,
                Numero = numero,
                Lid = lid,
                FotoDePerfil = participante.ProfilePicUrl,
                EhGrupo = grupo,
                EmpresaId = empresaId
            };
            db.Contatos.Add(resultado);
            acao = "create";
        }

        await db.SaveChangesAsync(cancellationToken);
        await realtime.ToCompanyAsync(empresaId, "contact", new { action = acao, contact = ContatoResposta.De(resultado) }, cancellationToken);
        return resultado;
    }

    public async Task CriarDoVcardAsync(string vcard, int empresaId, CancellationToken cancellationToken)
    {
        try
        {
            var numeros = new List<string>();
            var nome = string.Empty;
            foreach (var linha in vcard.Split('\n'))
            {
                var partes = linha.Split(':');
                for (var indice = 0; indice < partes.Length; indice++)
                {
                    if (partes[indice].Contains('+', StringComparison.Ordinal))
                    {
                        numeros.Add(partes[indice]);
                    }
                    if (partes[indice].Contains("FN", StringComparison.Ordinal) && indice + 1 < partes.Length && partes[indice + 1].Length > 0)
                    {
                        nome = partes[indice + 1];
                    }
                }
            }

            foreach (var numero in numeros.Select(item => NaoDigitos().Replace(item, string.Empty)).Where(item => item.Length > 0).Distinct())
            {
                if (!await db.Contatos.AnyAsync(contato => contato.Numero == numero && contato.EmpresaId == empresaId, cancellationToken))
                {
                    db.Contatos.Add(new Contato { Nome = nome, Numero = numero, EmpresaId = empresaId });
                }
            }

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            logger.LogError(exception, "Error processing vcard message");
        }
    }
}
