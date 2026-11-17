using Unmess.Api.Authentication;
using Unmess.Application.Usuarios;

namespace Unmess.Api.Endpoints;

public static class UsuarioEndpoints
{
    public static IEndpointRouteBuilder MapUsuarioEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var usuarios = endpoints.MapGroup("/users").RequireAuthorization();

        usuarios.MapGet("/", async (string? searchParam, string? pageNumber, UsuarioService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(searchParam, pageNumber, cancellationToken)))
            .RequireCompanyPermission("users:view");

        usuarios.MapPost("/", async (DadosDoUsuario dados, UsuarioService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarAsync(dados, cancellationToken)))
            .RequireCompanyPermission("users:create");

        usuarios.MapPut("/{userId:int}", async (int userId, DadosDoUsuario dados, UsuarioService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtualizarAsync(userId, dados, cancellationToken)))
            .RequireCompanyPermission("users:edit");

        usuarios.MapGet("/{userId:int}", async (int userId, UsuarioService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.MostrarAsync(userId, cancellationToken)))
            .RequireCompanyPermission("users:view");

        usuarios.MapDelete("/{userId:int}", async (int userId, UsuarioService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverAsync(userId, cancellationToken);
                return Results.Ok(new { message = "User deleted" });
            })
            .RequireCompanyPermission("users:delete");

        return endpoints;
    }
}
