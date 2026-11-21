using Unmess.Domain.Comum;

namespace Unmess.Domain.Contatos;

public sealed class Contato : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string? Numero { get; set; }
    public string? Lid { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FotoDePerfil { get; set; }
    public bool EhGrupo { get; set; }
    public bool Conhecido { get; set; }
    public int? EmpresaId { get; set; }
    public List<CampoDoContato> CamposExtras { get; set; } = [];
}
