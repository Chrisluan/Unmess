using Unmess.Domain.Comum;

namespace Unmess.Domain.Empresas;

public sealed class Empresa : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string? Documento { get; set; }
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    public string Plano { get; set; } = "basic";
    public string Situacao { get; set; } = "active";
    public DateTimeOffset? Vencimento { get; set; }
    public string? Logo { get; set; }
}
