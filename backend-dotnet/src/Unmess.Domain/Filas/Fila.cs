using Unmess.Domain.Comum;
using Unmess.Domain.Usuarios;

namespace Unmess.Domain.Filas;

public sealed class Fila : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string Cor { get; set; } = string.Empty;
    public string? MensagemDeSaudacao { get; set; }
    public int? EmpresaId { get; set; }
    public bool Padrao { get; set; }
    public List<Usuario> Usuarios { get; set; } = [];
}
