using Unmess.Application.Common;
using Unmess.Domain.Usuarios;

namespace Unmess.Application.Usuarios;

public interface IUsuarioAtual
{
    UsuarioAutenticado? Obter();
}

public static class UsuarioAtualExtensions
{
    public static UsuarioAutenticado Exigir(this IUsuarioAtual usuarioAtual) =>
        usuarioAtual.Obter() ?? throw AppException.Unauthorized(ErrorCodes.SessionExpired);

    public static int EmpresaIdObrigatoria(this IUsuarioAtual usuarioAtual) =>
        usuarioAtual.Exigir().EmpresaId ?? throw AppException.Forbidden(ErrorCodes.CompanyRequired);
}
