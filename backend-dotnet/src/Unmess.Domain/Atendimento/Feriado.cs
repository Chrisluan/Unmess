using Unmess.Domain.Comum;

namespace Unmess.Domain.Atendimento;

public sealed class Feriado : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public DateOnly Data { get; set; }
    public bool Recorrente { get; set; }
    public int EmpresaId { get; set; }
}
