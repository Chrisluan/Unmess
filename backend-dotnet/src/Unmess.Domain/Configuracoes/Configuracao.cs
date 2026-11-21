using Unmess.Domain.Comum;

namespace Unmess.Domain.Configuracoes;

public sealed class Configuracao : Entidade
{
    public string Chave { get; set; } = string.Empty;
    public string Valor { get; set; } = string.Empty;
    public int? EmpresaId { get; set; }
}
