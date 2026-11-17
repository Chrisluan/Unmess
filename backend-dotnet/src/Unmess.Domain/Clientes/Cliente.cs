using Unmess.Domain.Comum;
using Unmess.Domain.Contatos;
using Unmess.Domain.Usuarios;

namespace Unmess.Domain.Clientes;

public sealed class Cliente : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string? NomeFantasia { get; set; }
    public string TipoDePessoa { get; set; } = "PJ";
    public string? Documento { get; set; }
    public string? InscricaoEstadual { get; set; }
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    public string? Whatsapp { get; set; }
    public string? Cep { get; set; }
    public string? Logradouro { get; set; }
    public string? Numero { get; set; }
    public string? Complemento { get; set; }
    public string? Bairro { get; set; }
    public string? Cidade { get; set; }
    public string? Estado { get; set; }
    public string? Segmento { get; set; }
    public string? Origem { get; set; }
    public string Situacao { get; set; } = "lead";
    public string? Observacoes { get; set; }
    public int? ContatoId { get; set; }
    public Contato? Contato { get; set; }
    public int? ResponsavelId { get; set; }
    public Usuario? Responsavel { get; set; }
    public int EmpresaId { get; set; }
}
