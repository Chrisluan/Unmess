using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Contatos;
using Unmess.Application.Tickets;
using Unmess.Domain.Mensagens;

namespace Unmess.Application.Mensagens;

public sealed record MensagemResposta(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("ack")] int Ack,
    [property: JsonPropertyName("read")] bool Lida,
    [property: JsonPropertyName("fromMe")] bool DeMim,
    [property: JsonPropertyName("body")] string Corpo,
    [property: JsonPropertyName("mediaUrl")] string? Midia,
    [property: JsonPropertyName("mediaType")] string? TipoDeMidia,
    [property: JsonPropertyName("isDeleted")] bool Excluida,
    [property: JsonPropertyName("isInternal")] bool Interna,
    [property: JsonPropertyName("fromApp")] bool DoAplicativo,
    [property: JsonPropertyName("isEdited")] bool Editada,
    [property: JsonPropertyName("timestamp")] DateTimeOffset? Momento,
    [property: JsonPropertyName("userId")] int? UsuarioId,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm,
    [property: JsonPropertyName("quotedMsgId")] string? CitadaId,
    [property: JsonPropertyName("ticketId")] int TicketId,
    [property: JsonPropertyName("contactId")] int? ContatoId,
    [property: JsonPropertyName("contact")] ContatoResposta? Contato,
    [property: JsonPropertyName("user")] ReferenciaSimples? Usuario,
    [property: JsonPropertyName("quotedMsg")] MensagemResposta? Citada)
{
    public static string? EnderecoDaMidia(string? arquivo) => string.IsNullOrEmpty(arquivo) ? null : $"/public/{arquivo}";

    public static MensagemResposta De(Mensagem mensagem) => new(
        mensagem.Id,
        mensagem.Ack,
        mensagem.Lida,
        mensagem.DeMim,
        mensagem.Corpo,
        EnderecoDaMidia(mensagem.ArquivoDeMidia),
        mensagem.TipoDeMidia,
        mensagem.Excluida,
        mensagem.Interna,
        mensagem.DoAplicativo,
        mensagem.Editada,
        mensagem.Momento,
        mensagem.UsuarioId,
        mensagem.CriadoEm,
        mensagem.AtualizadoEm,
        mensagem.CitadaId,
        mensagem.TicketId,
        mensagem.ContatoId,
        mensagem.Contato is { } contato ? ContatoResposta.De(contato) : null,
        mensagem.Usuario is { } usuario ? new ReferenciaSimples(usuario.Id, usuario.Nome) : null,
        mensagem.Citada is { } citada ? De(citada) : null);
}

public static class MensagemConsultas
{
    public static IQueryable<Mensagem> ComDetalhes(this IQueryable<Mensagem> consulta) =>
        consulta
            .Include(mensagem => mensagem.Contato)
            .Include(mensagem => mensagem.Usuario)
            .Include(mensagem => mensagem.Citada!).ThenInclude(citada => citada.Contato);
}

public static class AckDaMensagem
{
    public static int DaSituacao(string situacao) => situacao switch
    {
        "sent" => 1,
        "delivered" => 2,
        "read" => 3,
        "played" => 4,
        _ => 0
    };
}
