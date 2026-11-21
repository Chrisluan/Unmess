using Unmess.Api.Authentication;
using Unmess.Application.Common;
using Unmess.Application.Conexoes;
using Unmess.Application.Figurinhas;
using Unmess.Application.Mensagens;
using Unmess.Application.Tickets;

namespace Unmess.Api.Endpoints;

public static class AtendimentoEndpoints
{
    public static IEndpointRouteBuilder MapAtendimentoEndpoints(this IEndpointRouteBuilder endpoints)
    {
        MapTickets(endpoints);
        MapMensagens(endpoints);
        MapConexoes(endpoints);
        return endpoints;
    }

    private static void MapTickets(IEndpointRouteBuilder endpoints)
    {
        var tickets = endpoints.MapGroup("/tickets").RequireAuthorization();

        tickets.MapGet("/tab-rules", () => Results.Ok(RegrasDasAbas.Todas)).RequireCompanyPermission("tickets:view");

        tickets.MapGet("/", async ([AsParameters] FiltrosDeTickets filtros, TicketService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(filtros, cancellationToken)))
            .RequireCompanyPermission("tickets:view");

        tickets.MapGet("/{ticketId:int}", async (int ticketId, TicketService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.MostrarAsync(ticketId, cancellationToken)))
            .RequireCompanyPermission("tickets:view");

        tickets.MapPost("/", async (DadosDoTicket dados, TicketService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarAsync(dados, cancellationToken)))
            .RequireCompanyPermission("tickets:create");

        tickets.MapPut("/{ticketId:int}", async (int ticketId, DadosDoTicket dados, TicketService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtualizarPelaRotaAsync(ticketId, dados, cancellationToken)))
            .RequireCompanyPermission("tickets:edit");

        tickets.MapDelete("/{ticketId:int}", async (int ticketId, TicketService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverAsync(ticketId, cancellationToken);
                return Results.Ok(new { message = "ticket deleted" });
            })
            .RequireCompanyPermission("tickets:delete");

        tickets.MapPut("/{ticketId:int}/tags", async (int ticketId, DadosDasEtiquetasDoTicket dados, TicketService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.SincronizarEtiquetasAsync(ticketId, dados, cancellationToken)))
            .RequireCompanyPermission("tags:assign");
    }

    private static void MapMensagens(IEndpointRouteBuilder endpoints)
    {
        var mensagens = endpoints.MapGroup("/messages").RequireAuthorization();

        mensagens.MapGet("/{ticketId:int}", async (int ticketId, string? pageNumber, string? searchParam, MensagemService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(ticketId, pageNumber, searchParam, cancellationToken)))
            .RequireCompanyPermission("tickets:view");

        mensagens.MapPost("/{ticketId:int}", async (int ticketId, HttpRequest request, MensagemService servico, CancellationToken cancellationToken) =>
            {
                DadosDaMensagem dados;
                var midias = new List<ArquivoEnviado>();
                if (request.HasFormContentType)
                {
                    var formulario = await request.ReadFormAsync(cancellationToken);
                    dados = new DadosDaMensagem { Corpo = formulario["body"].FirstOrDefault() };
                    midias.AddRange(formulario.Files.GetFiles("medias").Select(arquivo => new ArquivoEnviado(arquivo.FileName, arquivo.ContentType, arquivo.Length, arquivo.OpenReadStream)));
                }
                else
                {
                    dados = await request.ReadFromJsonAsync<DadosDaMensagem>(cancellationToken) ?? new DadosDaMensagem();
                }

                await servico.EnviarAsync(ticketId, dados, midias, cancellationToken);
                return Results.Ok();
            })
            .RequireCompanyPermission("tickets:edit")
            .DisableAntiforgery();

        mensagens.MapPost("/{ticketId:int}/notes", async (int ticketId, DadosDaMensagem dados, MensagemService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarNotaInternaAsync(ticketId, dados, cancellationToken)))
            .RequireCompanyPermission("tickets:edit");

        mensagens.MapPost("/{messageId}/forward", async (string messageId, DadosDeEncaminhamento dados, MensagemService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.EncaminharAsync(messageId, dados, cancellationToken)))
            .RequireCompanyPermission("tickets:edit");

        mensagens.MapPut("/{messageId}", async (string messageId, DadosDaMensagem dados, MensagemService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.EditarAsync(messageId, dados, cancellationToken)))
            .RequireCompanyPermission("tickets:edit");

        mensagens.MapDelete("/{messageId}", async (string messageId, MensagemService servico, CancellationToken cancellationToken) =>
            {
                await servico.ExcluirAsync(messageId, cancellationToken);
                return Results.Ok();
            })
            .RequireCompanyPermission("tickets:edit");

        var figurinhas = endpoints.MapGroup("/stickers").RequireAuthorization();
        figurinhas.MapPost("/from-message/{messageId}", async (string messageId, DadosDaFigurinha dados, FigurinhaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.SalvarDeMensagemAsync(messageId, dados.Nome, cancellationToken)))
            .RequireCompanyPermission("stickers:create");
        figurinhas.MapPost("/{stickerId:int}/send/{ticketId:int}", async (int stickerId, int ticketId, FigurinhaService servico, TicketService tickets, EnvioPeloWhatsapp envio, CancellationToken cancellationToken) =>
            {
                await servico.EnviarAsync(stickerId, ticketId, tickets, envio, cancellationToken);
                return Results.Ok();
            })
            .RequireCompanyPermission("stickers:send");
    }

    private static void MapConexoes(IEndpointRouteBuilder endpoints)
    {
        var conexoes = endpoints.MapGroup("/whatsapp").RequireAuthorization();

        conexoes.MapGet("/", async (ConexaoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(cancellationToken)))
            .RequireCompanyPermission("connections:view");

        conexoes.MapPost("/", async (DadosDaConexao dados, ConexaoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarAsync(dados, cancellationToken)))
            .RequireCompanyPermission("connections:create");

        conexoes.MapGet("/{whatsappId:int}", async (int whatsappId, ConexaoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.MostrarAsync(whatsappId, cancellationToken)))
            .RequireCompanyPermission("connections:view");

        conexoes.MapPut("/{whatsappId:int}", async (int whatsappId, DadosDaConexao dados, ConexaoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtualizarAsync(whatsappId, dados, cancellationToken)))
            .RequireCompanyPermission("connections:edit");

        conexoes.MapDelete("/{whatsappId:int}", async (int whatsappId, ConexaoService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverAsync(whatsappId, cancellationToken);
                return Results.Ok(new { message = "Whatsapp deleted." });
            })
            .RequireCompanyPermission("connections:delete");

        // Ligar, religar e derrubar o número tira o atendimento da empresa do ar:
        // o grupo só exige empresa, e cada rota exige connections:session, como no Node.
        var sessoes = endpoints.MapGroup("/whatsappsession").RequireAuthorization().RequireCompany();
        sessoes.MapPost("/{whatsappId:int}", async (int whatsappId, ConexaoService servico, CancellationToken cancellationToken) =>
        {
            await servico.IniciarSessaoAsync(whatsappId, cancellationToken);
            return Results.Ok(new { message = "Starting session." });
        })
            .RequirePermission("connections:session");
        sessoes.MapPut("/{whatsappId:int}", async (int whatsappId, ConexaoService servico, CancellationToken cancellationToken) =>
        {
            await servico.NovoQrCodeAsync(whatsappId, cancellationToken);
            return Results.Ok(new { message = "Starting session." });
        })
            .RequirePermission("connections:session");
        sessoes.MapDelete("/{whatsappId:int}", async (int whatsappId, ConexaoService servico, CancellationToken cancellationToken) =>
        {
            await servico.DesconectarAsync(whatsappId, cancellationToken);
            return Results.Ok(new { message = "Session disconnected." });
        })
            .RequirePermission("connections:session");
    }
}

public sealed record DadosDaFigurinha
{
    [System.Text.Json.Serialization.JsonPropertyName("name")] public string? Nome { get; init; }
}
