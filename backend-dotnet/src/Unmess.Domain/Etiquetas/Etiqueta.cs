using Unmess.Domain.Comum;

namespace Unmess.Domain.Etiquetas;

public sealed class Etiqueta : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string Cor { get; set; } = "#2ecc71";
    public int EmpresaId { get; set; }
}
