using Unmess.Domain.Comum;

namespace Unmess.Domain.Atendimento;

public sealed class SituacaoDeTicket : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string? Cor { get; set; }
    public string Tipo { get; set; } = "closed";
    public bool Padrao { get; set; }
    public int EmpresaId { get; set; }
}
