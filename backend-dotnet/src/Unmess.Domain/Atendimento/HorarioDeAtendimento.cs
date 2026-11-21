using Unmess.Domain.Comum;

namespace Unmess.Domain.Atendimento;

public sealed class HorarioDeAtendimento : Entidade
{
    public int DiaDaSemana { get; set; }
    public bool Ativo { get; set; } = true;
    public string? Inicio { get; set; } = "08:00";
    public string? Fim { get; set; } = "18:00";
    public int EmpresaId { get; set; }
}
