using Unmess.Domain.Comum;

namespace Unmess.Domain.Tickets;

public sealed class Ticket : Entidade
{
    public string Situacao { get; set; } = "pending";
    public string? UltimaMensagem { get; set; }
    public int? ContatoId { get; set; }
    public int? UsuarioId { get; set; }
    public int? ConexaoWhatsappId { get; set; }
    public bool EhGrupo { get; set; }
    public int? MensagensNaoLidas { get; set; }
    public int? FilaId { get; set; }
    public int? EmpresaId { get; set; }
    public int? SituacaoDeEncerramentoId { get; set; }
    public DateTimeOffset? PrimeiraRespostaEm { get; set; }
    public DateTimeOffset? EncerradoEm { get; set; }
    public string? Protocolo { get; set; }
    public bool SaudacaoEnviada { get; set; }
    public DateTimeOffset? UltimaMensagemEm { get; set; }
}
