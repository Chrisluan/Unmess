using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Domain.Usuarios;

namespace Unmess.Application.Permissoes;

/// <summary>
/// O escopo de uma dimensão já resolvido. Porta de backend/src/helpers/permissions/escopos.ts.
/// O padrão é negar: sem cargo ou sem escopo definido, nada é alcançado.
/// </summary>
public sealed record EscopoResolvido(bool Irrestrito, IReadOnlyList<int> Ids, IReadOnlyList<int> Negados)
{
    public static readonly EscopoResolvido Total = new(true, [], []);
    public static readonly EscopoResolvido Nenhum = new(false, [], []);

    /// <summary>Id nulo (ticket sem conexão registrada) sempre passa, como no backend Node.</summary>
    public bool Alcanca(int? id)
    {
        if (id is null)
        {
            return true;
        }

        if (Negados.Contains(id.Value))
        {
            return false;
        }

        return Irrestrito || Ids.Contains(id.Value);
    }

    /// <summary>Sem restrição nenhuma: não precisa entrar na consulta.</summary>
    public bool SemRestricao => Irrestrito && Negados.Count == 0;
}

public static class Escopos
{
    public const string Conexao = "connection";
    public const string Quadro = "board";
    public const string Conta = "account";

    public static EscopoResolvido Resolver(string? escoposDoCargo, string? excecoes, string chave)
    {
        var doCargo = LerObjeto(escoposDoCargo, chave);
        var excecao = LerObjeto(excecoes, chave);
        var permitir = Ids(excecao, "allow");
        var negar = Ids(excecao, "deny");

        if (doCargo is { } c && c.TryGetProperty("todos", out var todos) && todos.ValueKind == JsonValueKind.True)
        {
            return new EscopoResolvido(true, [], negar);
        }

        var baseIds = new SortedSet<int>(Ids(doCargo, "ids"));
        baseIds.UnionWith(permitir);
        baseIds.ExceptWith(negar);
        return new EscopoResolvido(false, baseIds.ToList(), negar);
    }

    /// <summary>Nunca lança: escopo corrompido no banco não derruba a requisição (vira "nada").</summary>
    private static JsonElement? LerObjeto(string? json, string chave)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            using var documento = JsonDocument.Parse(json);
            if (documento.RootElement.ValueKind == JsonValueKind.Object &&
                documento.RootElement.TryGetProperty(chave, out var item) && item.ValueKind == JsonValueKind.Object)
            {
                return item.Clone();
            }
        }
        catch (JsonException)
        {
        }

        return null;
    }

    private static List<int> Ids(JsonElement? objeto, string nome)
    {
        if (objeto is not { } o || !o.TryGetProperty(nome, out var lista) || lista.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var saida = new SortedSet<int>();
        foreach (var item in lista.EnumerateArray())
        {
            var valor = item.ValueKind switch
            {
                JsonValueKind.Number when item.TryGetInt32(out var n) => n,
                JsonValueKind.String when int.TryParse(item.GetString(), out var n) => n,
                _ => 0
            };
            if (valor > 0)
            {
                saida.Add(valor);
            }
        }

        return saida.ToList();
    }
}

public sealed class ResolvedorDeEscopos(IUnmessDbContext db)
{
    private readonly Dictionary<(int, string), EscopoResolvido> _cache = [];

    public async Task<EscopoResolvido> ResolverAsync(int usuarioId, string chave, CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue((usuarioId, chave), out var guardado))
        {
            return guardado;
        }

        var usuario = await db.Usuarios.AsNoTracking()
            .Where(item => item.Id == usuarioId)
            .Select(item => new { item.Perfil, Escopos = item.Cargo != null ? item.Cargo.Escopos : null, Tem = item.Cargo != null, item.ExcecoesDeEscopo })
            .FirstOrDefaultAsync(cancellationToken);

        // Só o super-admin ignora escopo; usuário inexistente ou sem cargo não alcança nada.
        var resolvido = usuario is null
            ? EscopoResolvido.Nenhum
            : string.Equals(usuario.Perfil, PerfilConversor.Super, StringComparison.OrdinalIgnoreCase)
                ? EscopoResolvido.Total
                : Escopos.Resolver(usuario.Tem ? usuario.Escopos : null, usuario.ExcecoesDeEscopo, chave);

        _cache[(usuarioId, chave)] = resolvido;
        return resolvido;
    }
}
