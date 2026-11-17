namespace Unmess.Domain.Usuarios;

public sealed record UsuarioAutenticado(
    int Id,
    string Nome,
    Perfil Perfil,
    int? EmpresaId,
    string? NomeEmpresa)
{
    public bool EhAdmin => Perfil is Perfil.Admin or Perfil.Super;
}
