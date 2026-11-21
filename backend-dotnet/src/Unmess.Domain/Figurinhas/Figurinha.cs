using Unmess.Domain.Comum;

namespace Unmess.Domain.Figurinhas;

public sealed class Figurinha : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string NomeDoArquivo { get; set; } = string.Empty;
    public bool Animada { get; set; }
    public int Tamanho { get; set; }
    public int EmpresaId { get; set; }
}
