using Unmess.Api.Authentication;
using Unmess.Application.Atendimento;
using Unmess.Application.Configuracoes;
using Unmess.Application.Etiquetas;
using Unmess.Application.Filas;
using Unmess.Application.RespostasRapidas;

namespace Unmess.Api.Endpoints;

public static class CadastroEndpoints
{
    public static IEndpointRouteBuilder MapCadastroEndpoints(this IEndpointRouteBuilder endpoints)
    {
        MapConfiguracoes(endpoints.MapGroup("/settings").RequireAuthorization());
        MapFilas(endpoints.MapGroup("/queue").RequireAuthorization());
        MapEtiquetas(endpoints.MapGroup("/tags").RequireAuthorization());
        MapRespostasRapidas(endpoints.MapGroup("/quick-answers").RequireAuthorization());
        MapSituacoesDeTicket(endpoints.MapGroup("/ticket-statuses").RequireAuthorization());
        MapHorarios(endpoints);
        return endpoints;
    }

    private static void MapConfiguracoes(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/attendance", async (ConfiguracaoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtendimentoAsync(cancellationToken)))
            .RequireCompanyPermission("tickets:view");

        grupo.MapGet("/", async (ConfiguracaoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(cancellationToken)))
            .RequireCompanyPermission("settings:view");

        grupo.MapPut("/{settingKey}", async (string settingKey, DadosDaConfiguracao dados, ConfiguracaoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtualizarAsync(settingKey, dados, cancellationToken)))
            .RequireCompanyPermission("settings:edit");
    }

    private static void MapFilas(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/", async (FilaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(cancellationToken)))
            .RequireCompanyPermission("queues:view");

        grupo.MapPost("/", async (DadosDaFila dados, FilaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarAsync(dados, cancellationToken)))
            .RequireCompanyPermission("queues:create");

        grupo.MapGet("/{queueId:int}", async (int queueId, FilaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.MostrarAsync(queueId, cancellationToken)))
            .RequireCompanyPermission("queues:view");

        grupo.MapPut("/{queueId:int}", async (int queueId, DadosDaFila dados, FilaService servico, CancellationToken cancellationToken) =>
                Results.Json(await servico.AtualizarAsync(queueId, dados, cancellationToken), statusCode: StatusCodes.Status201Created))
            .RequireCompanyPermission("queues:edit");

        grupo.MapDelete("/{queueId:int}", async (int queueId, FilaService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverAsync(queueId, cancellationToken);
                return Results.Ok();
            })
            .RequireCompanyPermission("queues:delete");
    }

    private static void MapEtiquetas(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/", async (string? searchParam, EtiquetaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(searchParam, cancellationToken)))
            .RequireCompanyPermission("tags:view");

        grupo.MapPost("/", async (DadosDaEtiqueta dados, EtiquetaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarAsync(dados, cancellationToken)))
            .RequireCompanyPermission("tags:create");

        grupo.MapPut("/{tagId:int}", async (int tagId, DadosDaEtiqueta dados, EtiquetaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtualizarAsync(tagId, dados, cancellationToken)))
            .RequireCompanyPermission("tags:edit");

        grupo.MapDelete("/{tagId:int}", async (int tagId, EtiquetaService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverAsync(tagId, cancellationToken);
                return Results.Ok(new { message = "Tag deleted" });
            })
            .RequireCompanyPermission("tags:delete");
    }

    private static void MapRespostasRapidas(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/", async (string? searchParam, string? pageNumber, RespostaRapidaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(searchParam, pageNumber, cancellationToken)))
            .RequireCompanyPermission("quickAnswers:view");

        grupo.MapGet("/{quickAnswerId:int}", async (int quickAnswerId, RespostaRapidaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.MostrarAsync(quickAnswerId, cancellationToken)))
            .RequireCompanyPermission("quickAnswers:view");

        grupo.MapPost("/", async (DadosDaRespostaRapida dados, RespostaRapidaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarAsync(dados, cancellationToken)))
            .RequireCompanyPermission("quickAnswers:create");

        grupo.MapPut("/{quickAnswerId:int}", async (int quickAnswerId, DadosDaRespostaRapida dados, RespostaRapidaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtualizarAsync(quickAnswerId, dados, cancellationToken)))
            .RequireCompanyPermission("quickAnswers:edit");

        grupo.MapDelete("/{quickAnswerId:int}", async (int quickAnswerId, RespostaRapidaService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverAsync(quickAnswerId, cancellationToken);
                return Results.Ok(new { message = "Quick Answer deleted" });
            })
            .RequireCompanyPermission("quickAnswers:delete");
    }

    private static void MapSituacoesDeTicket(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/", async (SituacaoDeTicketService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(cancellationToken)))
            .RequireCompanyPermission("tickets:view");

        grupo.MapPost("/", async (DadosDaSituacaoDeTicket dados, SituacaoDeTicketService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarAsync(dados, cancellationToken)))
            .RequireCompanyPermission("settings:edit");

        grupo.MapPut("/{ticketStatusId:int}", async (int ticketStatusId, DadosDaSituacaoDeTicket dados, SituacaoDeTicketService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtualizarAsync(ticketStatusId, dados, cancellationToken)))
            .RequireCompanyPermission("settings:edit");

        grupo.MapDelete("/{ticketStatusId:int}", async (int ticketStatusId, SituacaoDeTicketService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverAsync(ticketStatusId, cancellationToken);
                return Results.Ok(new { message = "Ticket status deleted" });
            })
            .RequireCompanyPermission("settings:edit");
    }

    private static void MapHorarios(IEndpointRouteBuilder endpoints)
    {
        var horarios = endpoints.MapGroup("/business-hours").RequireAuthorization();
        horarios.MapGet("/", async (HorarioDeAtendimentoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarHorariosAsync(cancellationToken)))
            .RequireCompanyPermission("settings:view");
        horarios.MapPut("/", async (DadosDosHorarios dados, HorarioDeAtendimentoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.SalvarHorariosAsync(dados, cancellationToken)))
            .RequireCompanyPermission("settings:edit");

        var feriados = endpoints.MapGroup("/holidays").RequireAuthorization();
        feriados.MapGet("/", async (HorarioDeAtendimentoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarFeriadosAsync(cancellationToken)))
            .RequireCompanyPermission("settings:view");
        feriados.MapPost("/", async (DadosDoFeriado dados, HorarioDeAtendimentoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarFeriadoAsync(dados, cancellationToken)))
            .RequireCompanyPermission("settings:edit");
        feriados.MapDelete("/{holidayId:int}", async (int holidayId, HorarioDeAtendimentoService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverFeriadoAsync(holidayId, cancellationToken);
                return Results.Ok(new { message = "Holiday deleted" });
            })
            .RequireCompanyPermission("settings:edit");
    }
}
