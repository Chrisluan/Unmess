using System.Text.Json.Serialization;

namespace Unmess.Application.Usuarios;

public sealed record FilaResumo(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("color")] string Cor);

public sealed record ConexaoResumo(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome);

public sealed record UsuarioSerializado(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("profile")] string Perfil,
    [property: JsonPropertyName("companyId")] int? EmpresaId,
    [property: JsonPropertyName("permissionGroupId")] int? GrupoDePermissaoId,
    [property: JsonPropertyName("customPermissions")] string? PermissoesPersonalizadas,
    [property: JsonPropertyName("maxSimultaneousTickets")] int MaximoDeTicketsSimultaneos,
    [property: JsonPropertyName("online")] bool Online,
    [property: JsonPropertyName("lastSeenAt")] DateTimeOffset? VistoPorUltimoEm,
    [property: JsonPropertyName("whatsappId")] int? ConexaoWhatsappId,
    [property: JsonPropertyName("queues")] IReadOnlyList<FilaResumo> Filas,
    [property: JsonPropertyName("whatsapp")] ConexaoResumo? Conexao);

public sealed record UsuarioDetalhado(
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("profile")] string Perfil,
    [property: JsonPropertyName("tokenVersion")] int VersaoDoToken,
    [property: JsonPropertyName("whatsappId")] int? ConexaoWhatsappId,
    [property: JsonPropertyName("companyId")] int? EmpresaId,
    [property: JsonPropertyName("queues")] IReadOnlyList<FilaResumo> Filas,
    [property: JsonPropertyName("whatsapp")] ConexaoResumo? Conexao)
{
    [JsonPropertyName("companyName")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? NomeEmpresa { get; init; }
}

public sealed record UsuarioDaLista(
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("profile")] string Perfil,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("maxSimultaneousTickets")] int MaximoDeTicketsSimultaneos,
    [property: JsonPropertyName("online")] bool Online,
    [property: JsonPropertyName("lastSeenAt")] DateTimeOffset? VistoPorUltimoEm,
    [property: JsonPropertyName("queues")] IReadOnlyList<FilaResumo> Filas,
    [property: JsonPropertyName("whatsapp")] ConexaoResumo? Conexao);

public sealed record ListaDeUsuarios(
    [property: JsonPropertyName("users")] IReadOnlyList<UsuarioDaLista> Usuarios,
    [property: JsonPropertyName("count")] int Total,
    [property: JsonPropertyName("hasMore")] bool TemMais);

public sealed record DadosDoUsuario
{
    [JsonPropertyName("email")] public string? Email { get; init; }
    [JsonPropertyName("password")] public string? Senha { get; init; }
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("profile")] public string? Perfil { get; init; }
    [JsonPropertyName("queueIds")] public List<int>? FilaIds { get; init; }
    [JsonPropertyName("whatsappId")] public int? ConexaoWhatsappId { get; init; }
    [JsonPropertyName("permissionGroupId")] public int? GrupoDePermissaoId { get; init; }
    [JsonPropertyName("maxSimultaneousTickets")] public int? MaximoDeTicketsSimultaneos { get; init; }
    [JsonPropertyName("customPermissions")] public PermissoesPersonalizadas? PermissoesPersonalizadas { get; init; }
}

public sealed record PermissoesPersonalizadas
{
    [JsonPropertyName("add")] public List<string>? Adicionar { get; init; }
    [JsonPropertyName("remove")] public List<string>? Remover { get; init; }
}
