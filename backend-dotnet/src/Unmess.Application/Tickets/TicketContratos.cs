using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Contatos;
using Unmess.Domain.Tickets;

namespace Unmess.Application.Tickets;

public sealed record ContatoDoTicket(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("number")] string? Numero,
    [property: JsonPropertyName("profilePicUrl")] string? FotoDePerfil,
    [property: JsonPropertyName("isKnown")] bool Conhecido)
{
    [JsonPropertyName("extraInfo")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<CampoDoContatoResposta>? CamposExtras { get; init; }
}

public sealed record ReferenciaSimples(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome);

public sealed record ReferenciaComCor(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("color")] string? Cor);

public sealed record TicketResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("status")] string Situacao,
    [property: JsonPropertyName("unreadMessages")] int? MensagensNaoLidas,
    [property: JsonPropertyName("lastMessage")] string? UltimaMensagem,
    [property: JsonPropertyName("isGroup")] bool EhGrupo,
    [property: JsonPropertyName("greetingSent")] bool SaudacaoEnviada,
    [property: JsonPropertyName("lastMessageAt")] DateTimeOffset? UltimaMensagemEm,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm,
    [property: JsonPropertyName("userId")] int? UsuarioId,
    [property: JsonPropertyName("contactId")] int? ContatoId,
    [property: JsonPropertyName("whatsappId")] int? ConexaoWhatsappId,
    [property: JsonPropertyName("queueId")] int? FilaId,
    [property: JsonPropertyName("companyId")] int? EmpresaId,
    [property: JsonPropertyName("closingStatusId")] int? SituacaoDeEncerramentoId,
    [property: JsonPropertyName("protocol")] string? Protocolo,
    [property: JsonPropertyName("firstResponseAt")] DateTimeOffset? PrimeiraRespostaEm,
    [property: JsonPropertyName("closedAt")] DateTimeOffset? EncerradoEm,
    [property: JsonPropertyName("contact")] ContatoDoTicket? Contato,
    [property: JsonPropertyName("user")] ReferenciaSimples? Usuario,
    [property: JsonPropertyName("queue")] ReferenciaComCor? Fila,
    [property: JsonPropertyName("whatsapp")] ReferenciaSimples? Conexao,
    [property: JsonPropertyName("tags")] IReadOnlyList<ReferenciaComCor> Etiquetas)
{
    public static TicketResposta De(Ticket ticket, bool comCamposDoContato = false) => new(
        ticket.Id,
        ticket.Situacao,
        ticket.MensagensNaoLidas,
        ticket.UltimaMensagem,
        ticket.EhGrupo,
        ticket.SaudacaoEnviada,
        ticket.UltimaMensagemEm,
        ticket.CriadoEm,
        ticket.AtualizadoEm,
        ticket.UsuarioId,
        ticket.ContatoId,
        ticket.ConexaoWhatsappId,
        ticket.FilaId,
        ticket.EmpresaId,
        ticket.SituacaoDeEncerramentoId,
        ticket.Protocolo,
        ticket.PrimeiraRespostaEm,
        ticket.EncerradoEm,
        ticket.Contato is { } contato
            ? new ContatoDoTicket(contato.Id, contato.Nome, contato.Numero, contato.FotoDePerfil, contato.Conhecido)
            {
                CamposExtras = comCamposDoContato ? contato.CamposExtras.OrderBy(campo => campo.Id).Select(CampoDoContatoResposta.De).ToList() : null
            }
            : null,
        ticket.Usuario is { } usuario ? new ReferenciaSimples(usuario.Id, usuario.Nome) : null,
        ticket.Fila is { } fila ? new ReferenciaComCor(fila.Id, fila.Nome, fila.Cor) : null,
        ticket.ConexaoWhatsapp is { } conexao ? new ReferenciaSimples(conexao.Id, conexao.Nome) : null,
        ticket.Etiquetas.OrderBy(etiqueta => etiqueta.Nome).Select(etiqueta => new ReferenciaComCor(etiqueta.Id, etiqueta.Nome, etiqueta.Cor)).ToList());
}

public static class TicketConsultas
{
    public static IQueryable<Ticket> ComDetalhes(this IQueryable<Ticket> consulta, bool comCamposDoContato = false)
    {
        var resultado = consulta
            .Include(ticket => ticket.Usuario)
            .Include(ticket => ticket.Fila)
            .Include(ticket => ticket.ConexaoWhatsapp)
            .Include(ticket => ticket.Etiquetas);
        return comCamposDoContato
            ? resultado.Include(ticket => ticket.Contato!).ThenInclude(contato => contato.CamposExtras)
            : resultado.Include(ticket => ticket.Contato);
    }
}

public static class SituacoesDoTicket
{
    public const string Aberto = "open";
    public const string Pendente = "pending";
    public const string Encerrado = "closed";
}
