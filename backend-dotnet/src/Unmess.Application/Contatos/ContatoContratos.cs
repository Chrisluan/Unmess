using System.Text.Json.Serialization;
using Unmess.Domain.Contatos;

namespace Unmess.Application.Contatos;

public sealed record CampoDoContatoResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("value")] string Valor,
    [property: JsonPropertyName("contactId")] int ContatoId,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm)
{
    public static CampoDoContatoResposta De(CampoDoContato campo) =>
        new(campo.Id, campo.Nome, campo.Valor, campo.ContatoId, campo.CriadoEm, campo.AtualizadoEm);
}

public sealed record ContatoResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("number")] string? Numero,
    [property: JsonPropertyName("lid")] string? Lid,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("profilePicUrl")] string? FotoDePerfil,
    [property: JsonPropertyName("isGroup")] bool EhGrupo,
    [property: JsonPropertyName("isKnown")] bool Conhecido,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm,
    [property: JsonPropertyName("companyId")] int? EmpresaId)
{
    [JsonPropertyName("extraInfo")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<CampoDoContatoResposta>? CamposExtras { get; init; }

    public static ContatoResposta De(Contato contato, bool comCampos = false) => new(
        contato.Id, contato.Nome, contato.Numero, contato.Lid, contato.Email, contato.FotoDePerfil,
        contato.EhGrupo, contato.Conhecido, contato.CriadoEm, contato.AtualizadoEm, contato.EmpresaId)
    {
        CamposExtras = comCampos ? contato.CamposExtras.OrderBy(campo => campo.Id).Select(CampoDoContatoResposta.De).ToList() : null
    };
}

public sealed record ContatoEditado(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("number")] string? Numero,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("profilePicUrl")] string? FotoDePerfil,
    [property: JsonPropertyName("extraInfo")] IReadOnlyList<CampoDoContatoResposta> CamposExtras);

public sealed record ContatoResumido(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("number")] string? Numero,
    [property: JsonPropertyName("profilePicUrl")] string? FotoDePerfil);

public sealed record ListaDeContatos(
    [property: JsonPropertyName("contacts")] IReadOnlyList<ContatoResposta> Contatos,
    [property: JsonPropertyName("count")] int Total,
    [property: JsonPropertyName("hasMore")] bool TemMais);

public sealed record CampoExtra
{
    [JsonPropertyName("id")] public int? Id { get; init; }
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("value")] public string? Valor { get; init; }
}

public sealed record DadosDoContato
{
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("number")] public string? Numero { get; init; }
    [JsonPropertyName("email")] public string? Email { get; init; }
    [JsonPropertyName("extraInfo")] public List<CampoExtra>? CamposExtras { get; init; }
}

public sealed record DadosDeConhecido
{
    [JsonPropertyName("isKnown")] public bool? Conhecido { get; init; }
}
