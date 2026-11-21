using Unmess.Domain.Comum;

namespace Unmess.Domain.Usuarios;

public sealed class GrupoDePermissao : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string Permissoes { get; set; } = "[]";
    public int EmpresaId { get; set; }
}
