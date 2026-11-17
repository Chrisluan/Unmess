using Unmess.Application.Usuarios;
using Unmess.Domain.Usuarios;

namespace Unmess.Api.Endpoints;

public static class WhoAmIEndpoints
{
    public static IEndpointRouteBuilder MapWhoAmIEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/internal/whoami", (IUsuarioAtual usuarioAtual) =>
                usuarioAtual.Obter() is { } usuario
                    ? Results.Ok(new WhoAmIResponse(
                        usuario.Id,
                        usuario.Nome,
                        PerfilConversor.ParaTexto(usuario.Perfil),
                        usuario.EmpresaId,
                        usuario.NomeEmpresa))
                    : Results.Unauthorized())
            .RequireAuthorization()
            .WithName("WhoAmI");

        return endpoints;
    }

    public sealed record WhoAmIResponse(int Id, string Username, string Profile, int? CompanyId, string? CompanyName);
}
