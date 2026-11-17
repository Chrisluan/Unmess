using Unmess.Domain.Comum;

namespace Unmess.Domain.Produtos;

public sealed class Produto : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string? Codigo { get; set; }
    public string? Descricao { get; set; }
    public string Unidade { get; set; } = "un";
    public decimal Preco { get; set; }
    public decimal Custo { get; set; }
    public string ModoDePreco { get; set; } = "unit";
    public decimal MedidaMinima { get; set; }
    public string? Categoria { get; set; }
    public bool Ativo { get; set; } = true;
    public int EmpresaId { get; set; }
}
