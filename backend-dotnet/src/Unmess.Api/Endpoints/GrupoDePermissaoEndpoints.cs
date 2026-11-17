using Unmess.Api.Authentication;
using Unmess.Application.Permissoes;

namespace Unmess.Api.Endpoints;

public static class GrupoDePermissaoEndpoints
{
    public static IEndpointRouteBuilder MapGrupoDePermissaoEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var grupos = endpoints.MapGroup("/permission-groups").RequireAuthorization();

        grupos.MapGet("/available", () => Results.Ok(GrupoDePermissaoService.Disponiveis()));

        grupos.MapGet("/modules", () => Results.Ok(GrupoDePermissaoService.Modulos()));

        grupos.MapGet("/user/{userId:int}", async (int userId, GrupoDePermissaoService servico, CancellationToken cancellationToken) =>
            Results.Ok(await servico.DoUsuarioAsync(userId, cancellationToken)));

        grupos.MapGet("/", async (GrupoDePermissaoService servico, CancellationToken cancellationToken) =>
            Results.Ok(await servico.ListarAsync(cancellationToken)));

        grupos.MapGet("/{permissionGroupId:int}", async (int permissionGroupId, GrupoDePermissaoService servico, CancellationToken cancellationToken) =>
            Results.Ok(await servico.MostrarAsync(permissionGroupId, cancellationToken)));

        grupos.MapPost("/", async (DadosDoGrupo dados, GrupoDePermissaoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarAsync(dados, cancellationToken)))
            .RequireAdmin();

        grupos.MapPut("/{permissionGroupId:int}", async (int permissionGroupId, DadosDoGrupo dados, GrupoDePermissaoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtualizarAsync(permissionGroupId, dados, cancellationToken)))
            .RequireAdmin();

        grupos.MapDelete("/{permissionGroupId:int}", async (int permissionGroupId, GrupoDePermissaoService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverAsync(permissionGroupId, cancellationToken);
                return Results.Ok(new { message = "Permission group deleted" });
            })
            .RequireAdmin();

        return endpoints;
    }
}
