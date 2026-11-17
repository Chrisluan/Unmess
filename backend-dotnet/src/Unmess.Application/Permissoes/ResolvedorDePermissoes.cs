using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Domain.Usuarios;

namespace Unmess.Application.Permissoes;

public sealed record PermissoesDoUsuario(
    [property: JsonPropertyName("permissions")] IReadOnlyList<string> Permissoes,
    [property: JsonPropertyName("groupPermissions")] IReadOnlyList<string> PermissoesDoGrupo,
    [property: JsonPropertyName("overrides")] Sobrescritas Sobrescritas);

public sealed record Sobrescritas(
    [property: JsonPropertyName("allow")] IReadOnlyList<string> Permitir,
    [property: JsonPropertyName("deny")] IReadOnlyList<string> Negar);

public sealed class ResolvedorDePermissoes(IUnmessDbContext db)
{
    private static readonly PermissoesDoUsuario Nenhuma = new([], [], new Sobrescritas([], []));

    public async Task<PermissoesDoUsuario> ResolverAsync(int usuarioId, CancellationToken cancellationToken)
    {
        var usuario = await db.Usuarios.AsNoTracking()
            .Include(item => item.GrupoDePermissao)
            .FirstOrDefaultAsync(item => item.Id == usuarioId, cancellationToken);

        if (usuario is null)
        {
            return Nenhuma;
        }

        if (PerfilConversor.TemAcessoTotal(usuario.Perfil))
        {
            return new PermissoesDoUsuario(CatalogoDePermissoes.Todas, [], new Sobrescritas([], []));
        }

        var doGrupo = LerLista(usuario.GrupoDePermissao?.Permissoes);
        var (adicionar, remover) = LerPersonalizadas(usuario.PermissoesPersonalizadas);

        var finais = new List<string>(doGrupo);
        foreach (var permissao in adicionar.Where(permissao => !finais.Contains(permissao)))
        {
            finais.Add(permissao);
        }
        finais.RemoveAll(remover.Contains);

        return new PermissoesDoUsuario(
            finais.Where(CatalogoDePermissoes.Existe).ToList(),
            doGrupo,
            new Sobrescritas(adicionar, remover));
    }

    public async Task<bool> PossuiAsync(int usuarioId, string permissao, CancellationToken cancellationToken) =>
        (await ResolverAsync(usuarioId, cancellationToken)).Permissoes.Contains(permissao);

    private static List<string> LerLista(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            using var documento = JsonDocument.Parse(json);
            return documento.RootElement.ValueKind == JsonValueKind.Array
                ? documento.RootElement.EnumerateArray().Where(item => item.ValueKind == JsonValueKind.String).Select(item => item.GetString()!).ToList()
                : [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static (List<string> Adicionar, List<string> Remover) LerPersonalizadas(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return ([], []);
        }

        try
        {
            using var documento = JsonDocument.Parse(json);
            if (documento.RootElement.ValueKind != JsonValueKind.Object)
            {
                return ([], []);
            }

            return (Ler(documento.RootElement, "add"), Ler(documento.RootElement, "remove"));
        }
        catch (JsonException)
        {
            return ([], []);
        }

        static List<string> Ler(JsonElement raiz, string nome) =>
            raiz.TryGetProperty(nome, out var lista) && lista.ValueKind == JsonValueKind.Array
                ? lista.EnumerateArray().Where(item => item.ValueKind == JsonValueKind.String).Select(item => item.GetString()!).ToList()
                : [];
    }
}
