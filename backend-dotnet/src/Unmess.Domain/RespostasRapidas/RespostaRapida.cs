using Unmess.Domain.Comum;

namespace Unmess.Domain.RespostasRapidas;

public sealed class RespostaRapida : Entidade
{
    public string Atalho { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;
    public int? EmpresaId { get; set; }
}
