using Unmess.Domain.Atendimento;
using Unmess.Domain.Comum;
using Unmess.Domain.Conexoes;
using Unmess.Domain.Contatos;
using Unmess.Domain.Filas;
using Unmess.Domain.Usuarios;

namespace Unmess.Domain.Tickets;

public sealed class Ticket : Entidade
{
    public string Situacao { get; set; } = "pending";
    public string? UltimaMensagem { get; set; }
    public int? ContatoId { get; set; }
    public Contato? Contato { get; set; }
    public int? UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    public int? ConexaoWhatsappId { get; set; }
    public ConexaoWhatsapp? ConexaoWhatsapp { get; set; }
    public bool EhGrupo { get; set; }
    public int? MensagensNaoLidas { get; set; }
    public int? FilaId { get; set; }
    public Fila? Fila { get; set; }
    public int? EmpresaId { get; set; }
    public int? SituacaoDeEncerramentoId { get; set; }
    public SituacaoDeTicket? SituacaoDeEncerramento { get; set; }
    public DateTimeOffset? PrimeiraRespostaEm { get; set; }
    public DateTimeOffset? EncerradoEm { get; set; }
    public string? Protocolo { get; set; }
    public bool SaudacaoEnviada { get; set; }
    public DateTimeOffset? UltimaMensagemEm { get; set; }
    public List<Unmess.Domain.Etiquetas.Etiqueta> Etiquetas { get; set; } = [];
}
