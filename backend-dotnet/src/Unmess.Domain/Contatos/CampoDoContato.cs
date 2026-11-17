using Unmess.Domain.Comum;

namespace Unmess.Domain.Contatos;

public sealed class CampoDoContato : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string Valor { get; set; } = string.Empty;
    public int ContatoId { get; set; }
}
