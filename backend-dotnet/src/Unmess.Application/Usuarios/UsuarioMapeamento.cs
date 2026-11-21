using Unmess.Domain.Usuarios;

namespace Unmess.Application.Usuarios;

public static class UsuarioMapeamento
{
    public static IReadOnlyList<FilaResumo> FilasResumidas(Usuario usuario) =>
        usuario.Filas.OrderBy(fila => fila.Nome, StringComparer.OrdinalIgnoreCase)
            .Select(fila => new FilaResumo(fila.Id, fila.Nome, fila.Cor))
            .ToList();

    public static ConexaoResumo? ConexaoResumida(Usuario usuario) =>
        usuario.ConexaoWhatsapp is { } conexao ? new ConexaoResumo(conexao.Id, conexao.Nome) : null;

    public static UsuarioSerializado Serializar(Usuario usuario) => new(
        usuario.Id,
        usuario.Nome,
        usuario.Email,
        usuario.Perfil,
        usuario.EmpresaId,
        usuario.GrupoDePermissaoId,
        usuario.PermissoesPersonalizadas,
        usuario.MaximoDeTicketsSimultaneos,
        usuario.Online,
        usuario.VistoPorUltimoEm,
        usuario.ConexaoWhatsappId,
        FilasResumidas(usuario),
        ConexaoResumida(usuario));

    public static UsuarioDetalhado Detalhar(Usuario usuario) => new(
        usuario.Nome,
        usuario.Id,
        usuario.Email,
        usuario.Perfil,
        usuario.VersaoDoToken,
        usuario.ConexaoWhatsappId,
        usuario.EmpresaId,
        FilasResumidas(usuario),
        ConexaoResumida(usuario));
}
