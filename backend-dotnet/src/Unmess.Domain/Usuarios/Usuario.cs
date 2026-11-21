using Unmess.Domain.Comum;
using Unmess.Domain.Conexoes;
using Unmess.Domain.Empresas;
using Unmess.Domain.Filas;

namespace Unmess.Domain.Usuarios;

public sealed class Usuario : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string HashDaSenha { get; set; } = string.Empty;
    public string Perfil { get; set; } = "admin";
    public int VersaoDoToken { get; set; }
    public int? ConexaoWhatsappId { get; set; }
    public ConexaoWhatsapp? ConexaoWhatsapp { get; set; }
    public int? EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }
    public int? GrupoDePermissaoId { get; set; }
    public GrupoDePermissao? GrupoDePermissao { get; set; }
    public string? PermissoesPersonalizadas { get; set; }
    public int? CargoId { get; set; }
    public Cargo? Cargo { get; set; }
    public string? ExcecoesDeEscopo { get; set; }
    public bool Online { get; set; }
    public int MaximoDeTicketsSimultaneos { get; set; }
    public DateTimeOffset? VistoPorUltimoEm { get; set; }
    public List<Fila> Filas { get; set; } = [];
}
