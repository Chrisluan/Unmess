using System.Text.Json.Serialization;

namespace Unmess.Application.Tickets;

public sealed record RegraDaAba(
    [property: JsonPropertyName("status")] object Situacao,
    [property: JsonPropertyName("userId"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Atendente = null,
    [property: JsonPropertyName("queueId"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Setor = null,
    [property: JsonPropertyName("isGroup"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? EhGrupo = null,
    [property: JsonPropertyName("contactIsKnown"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? ContatoConhecido = null)
{
    [JsonIgnore]
    public IReadOnlyList<string> Situacoes => Situacao switch
    {
        string unica => [unica],
        string[] varias => varias,
        _ => []
    };
}

public static class RegrasDasAbas
{
    public static readonly IReadOnlyDictionary<string, RegraDaAba> Todas = new Dictionary<string, RegraDaAba>
    {
        ["myTickets"] = new(SituacoesDoTicket.Aberto, Atendente: "me"),
        ["attending"] = new(SituacoesDoTicket.Aberto, Atendente: "other", Setor: "mine"),
        ["waiting"] = new(SituacoesDoTicket.Pendente, Atendente: "none", Setor: "mineOrNone", ContatoConhecido: false),
        ["known"] = new(new[] { SituacoesDoTicket.Aberto, SituacoesDoTicket.Pendente }, ContatoConhecido: true),
        ["groups"] = new(new[] { SituacoesDoTicket.Aberto, SituacoesDoTicket.Pendente }, EhGrupo: true)
    };
}
