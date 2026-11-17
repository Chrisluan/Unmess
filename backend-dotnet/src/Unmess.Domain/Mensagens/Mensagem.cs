using Unmess.Domain.Comum;
using Unmess.Domain.Contatos;
using Unmess.Domain.Tickets;
using Unmess.Domain.Usuarios;

namespace Unmess.Domain.Mensagens;

public sealed class Mensagem : IRegistroComDatas
{
    public string Id { get; set; } = string.Empty;
    public string Corpo { get; set; } = string.Empty;
    public int Ack { get; set; }
    public bool Lida { get; set; }
    public string? TipoDeMidia { get; set; }
    public string? ArquivoDeMidia { get; set; }
    public int TicketId { get; set; }
    public Ticket? Ticket { get; set; }
    public bool DeMim { get; set; }
    public bool Excluida { get; set; }
    public int? ContatoId { get; set; }
    public Contato? Contato { get; set; }
    public string? CitadaId { get; set; }
    public Mensagem? Citada { get; set; }
    public bool Interna { get; set; }
    public int? UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    public bool DoAplicativo { get; set; }
    public bool Editada { get; set; }
    public DateTimeOffset? Momento { get; set; }
    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset AtualizadoEm { get; set; }
}
