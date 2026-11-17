using Unmess.Domain.Comum;
using Unmess.Domain.Filas;

namespace Unmess.Domain.Conexoes;

public sealed class ConexaoWhatsapp : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string? Sessao { get; set; }
    public string? QrCode { get; set; }
    public string? Situacao { get; set; }
    public string? Bateria { get; set; }
    public bool? Carregando { get; set; }
    public bool Padrao { get; set; }
    public int Tentativas { get; set; }
    public string? MensagemDeSaudacao { get; set; }
    public string? MensagemDeDespedida { get; set; }
    public int? EmpresaId { get; set; }
    public string? Numero { get; set; }
    public List<Fila> Filas { get; set; } = [];
}
