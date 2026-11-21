using Unmess.Domain.Comum;

namespace Unmess.Domain.Usuarios;

/// <summary>
/// Cargo (tabela Roles). Aqui só interessa o escopo; as permissões do cargo
/// continuam sendo resolvidas pelos grupos antigos neste backend.
/// </summary>
public sealed class Cargo : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string? Escopos { get; set; }
    public int EmpresaId { get; set; }
}
