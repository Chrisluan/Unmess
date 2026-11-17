using System.Security.Claims;
using Unmess.Application.Usuarios;
using Unmess.Domain.Usuarios;

namespace Unmess.Api.Authentication;

public sealed class UsuarioAtualDoToken(IHttpContextAccessor httpContextAccessor) : IUsuarioAtual
{
    public UsuarioAutenticado? Obter()
    {
        var principal = httpContextAccessor.HttpContext?.User;
        if (principal?.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        if (!int.TryParse(principal.FindFirstValue(LegacyJwtClaims.Id), out var id))
        {
            return null;
        }

        return new UsuarioAutenticado(
            id,
            principal.FindFirstValue(LegacyJwtClaims.Username) ?? string.Empty,
            PerfilConversor.DoTexto(principal.FindFirstValue(LegacyJwtClaims.Profile)),
            ParseNullableInt(principal.FindFirstValue(LegacyJwtClaims.CompanyId)),
            NullIfEmpty(principal.FindFirstValue(LegacyJwtClaims.CompanyName)));
    }

    private static int? ParseNullableInt(string? value) => int.TryParse(value, out var parsed) ? parsed : null;

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) || value == "null" ? null : value;
}
