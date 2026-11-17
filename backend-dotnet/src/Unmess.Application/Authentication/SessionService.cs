using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Domain.Usuarios;

namespace Unmess.Application.Authentication;

public sealed record AccessTokenClaims(int UserId, string Username, string Profile, int? CompanyId, string? CompanyName);

public sealed record RefreshTokenClaims(int UserId, int TokenVersion);

public interface ITokenIssuer
{
    string CreateAccessToken(AccessTokenClaims claims);
    string CreateRefreshToken(RefreshTokenClaims claims);
    RefreshTokenClaims? ReadRefreshToken(string token);
    AccessTokenClaims? ReadAccessTokenWithoutValidation(string token);
}

public sealed record LoginRequest
{
    [JsonPropertyName("email")] public string? Email { get; init; }
    [JsonPropertyName("password")] public string? Password { get; init; }
}

public sealed record LoginResult(
    [property: JsonPropertyName("token")] string Token,
    [property: JsonPropertyName("user")] UsuarioSerializado User,
    [property: JsonIgnore] string RefreshToken);

public sealed record RefreshResult(
    [property: JsonPropertyName("token")] string Token,
    [property: JsonPropertyName("user")] UsuarioDetalhado User,
    [property: JsonIgnore] string RefreshToken);

public sealed record SelectCompanyRequest
{
    [JsonPropertyName("companyId")] public int CompanyId { get; init; }
}

public sealed record TokenResult([property: JsonPropertyName("token")] string Token);

public sealed class SessionService(
    IUnmessDbContext db,
    IUsuarioAtual usuarioAtual,
    IPasswordHasher passwordHasher,
    ITokenIssuer tokens,
    UsuarioService usuarios)
{
    public const string CompanyNotFound = "Empresa não encontrada";
    public const string UserNotFound = "ERR_USER_NOT_FOUND";

    public async Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var usuario = await db.Usuarios.AsNoTracking()
            .Include(item => item.Filas)
            .FirstOrDefaultAsync(item => item.Email == request.Email, cancellationToken);

        if (usuario is null || string.IsNullOrEmpty(request.Password) || !passwordHasher.Verify(request.Password, usuario.HashDaSenha))
        {
            throw AppException.Unauthorized(ErrorCodes.InvalidCredentials);
        }

        return new LoginResult(
            tokens.CreateAccessToken(ClaimsFor(usuario, usuario.EmpresaId, null)),
            UsuarioMapeamento.Serializar(usuario),
            tokens.CreateRefreshToken(new RefreshTokenClaims(usuario.Id, usuario.VersaoDoToken)));
    }

    public async Task<RefreshResult> RefreshAsync(string? refreshToken, string? currentAccessToken, CancellationToken cancellationToken)
    {
        var claims = string.IsNullOrEmpty(refreshToken) ? null : tokens.ReadRefreshToken(refreshToken);
        if (claims is null)
        {
            throw AppException.Unauthorized(ErrorCodes.SessionExpired);
        }

        Usuario usuario;
        try
        {
            usuario = await usuarios.CarregarAsync(claims.UserId, cancellationToken);
        }
        catch (AppException)
        {
            throw AppException.Unauthorized(ErrorCodes.SessionExpired);
        }

        if (usuario.VersaoDoToken != claims.TokenVersion)
        {
            throw AppException.Unauthorized(ErrorCodes.SessionExpired);
        }

        var detalhado = UsuarioMapeamento.Detalhar(usuario);
        var empresaId = usuario.EmpresaId;
        string? nomeEmpresa = null;

        var anterior = string.IsNullOrEmpty(currentAccessToken) ? null : tokens.ReadAccessTokenWithoutValidation(currentAccessToken);
        if (usuario.Perfil == PerfilConversor.Super && anterior?.CompanyId is { } escolhida)
        {
            empresaId = escolhida;
            nomeEmpresa = anterior.CompanyName;
            detalhado = detalhado with { EmpresaId = escolhida, NomeEmpresa = nomeEmpresa };
        }

        return new RefreshResult(
            tokens.CreateAccessToken(ClaimsFor(usuario, empresaId, nomeEmpresa)),
            detalhado,
            tokens.CreateRefreshToken(new RefreshTokenClaims(usuario.Id, usuario.VersaoDoToken)));
    }

    public async Task<TokenResult> SelectCompanyAsync(SelectCompanyRequest request, CancellationToken cancellationToken)
    {
        var atual = usuarioAtual.Exigir();
        if (atual.Perfil != Perfil.Super)
        {
            throw AppException.Forbidden();
        }

        var empresa = await db.Empresas.AsNoTracking().FirstOrDefaultAsync(item => item.Id == request.CompanyId, cancellationToken)
                      ?? throw AppException.NotFound(CompanyNotFound);
        var usuario = await db.Usuarios.AsNoTracking().FirstOrDefaultAsync(item => item.Id == atual.Id, cancellationToken)
                      ?? throw AppException.NotFound(UserNotFound);

        return new TokenResult(tokens.CreateAccessToken(ClaimsFor(usuario, empresa.Id, empresa.Nome)));
    }

    private static AccessTokenClaims ClaimsFor(Usuario usuario, int? companyId, string? companyName) =>
        new(usuario.Id, usuario.Nome, usuario.Perfil, companyId, companyName);
}
