using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Domain.Usuarios;

namespace Unmess.Application.Permissoes;

public sealed record GrupoDePermissaoResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("permissions")] string Permissoes,
    [property: JsonPropertyName("companyId")] int EmpresaId,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm)
{
    public static GrupoDePermissaoResposta De(GrupoDePermissao grupo) =>
        new(grupo.Id, grupo.Nome, grupo.Permissoes, grupo.EmpresaId, grupo.CriadoEm, grupo.AtualizadoEm);
}

public sealed record DadosDoGrupo
{
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("permissions")] public List<string>? Permissoes { get; init; }
}

public sealed record ModuloDePermissaoResposta(
    [property: JsonPropertyName("label")] string Rotulo,
    [property: JsonPropertyName("permissions")] IReadOnlyDictionary<string, string> Permissoes);

public sealed class GrupoDePermissaoService(
    IUnmessDbContext db,
    IUsuarioAtual usuarioAtual,
    ResolvedorDePermissoes resolvedor,
    IRealtimePublisher realtime)
{
    public const string ErroGrupoNaoEncontrado = "ERR_NO_PERMISSION_GROUP_FOUND";
    public const string ErroGrupoComUsuarios = "ERR_PERMISSION_GROUP_HAS_USERS";

    public static IReadOnlyList<string> Disponiveis() => CatalogoDePermissoes.Todas;

    public static IReadOnlyDictionary<string, ModuloDePermissaoResposta> Modulos() =>
        CatalogoDePermissoes.Modulos.ToDictionary(
            par => par.Key,
            par => new ModuloDePermissaoResposta(par.Value.Rotulo, par.Value.Permissoes));

    public async Task<PermissoesDoUsuario> DoUsuarioAsync(int usuarioId, CancellationToken cancellationToken)
    {
        var atual = usuarioAtual.Exigir();
        if (atual.Perfil == Perfil.Usuario && atual.Id != usuarioId)
        {
            throw AppException.Forbidden();
        }

        return await resolvedor.ResolverAsync(usuarioId, cancellationToken);
    }

    public async Task<IReadOnlyList<GrupoDePermissaoResposta>> ListarAsync(CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var grupos = await db.GruposDePermissao.AsNoTracking()
            .Where(grupo => grupo.EmpresaId == empresaId)
            .OrderBy(grupo => grupo.Nome)
            .ToListAsync(cancellationToken);
        return grupos.Select(GrupoDePermissaoResposta.De).ToList();
    }

    public async Task<GrupoDePermissaoResposta> MostrarAsync(int id, CancellationToken cancellationToken) =>
        GrupoDePermissaoResposta.De(await BuscarAsync(id, usuarioAtual.EmpresaIdObrigatoria(), cancellationToken));

    public async Task<GrupoDePermissaoResposta> CriarAsync(DadosDoGrupo dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        Validation.Required(dados.Nome, "name");
        Validation.MinLength(dados.Nome, "name", 2);

        var grupo = new GrupoDePermissao
        {
            Nome = dados.Nome!,
            Permissoes = Serializar(dados.Permissoes ?? []),
            EmpresaId = empresaId
        };
        db.GruposDePermissao.Add(grupo);
        await db.SaveChangesAsync(cancellationToken);

        var resposta = GrupoDePermissaoResposta.De(grupo);
        await realtime.ToCompanyAsync(empresaId, "permissionGroup", new { action = "create", permissionGroup = resposta }, cancellationToken);
        return resposta;
    }

    public async Task<GrupoDePermissaoResposta> AtualizarAsync(int id, DadosDoGrupo dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var grupo = await BuscarAsync(id, empresaId, cancellationToken);
        if (dados.Nome is not null)
        {
            grupo.Nome = dados.Nome;
        }
        if (dados.Permissoes is not null)
        {
            grupo.Permissoes = Serializar(dados.Permissoes);
        }
        await db.SaveChangesAsync(cancellationToken);

        var resposta = GrupoDePermissaoResposta.De(grupo);
        await realtime.ToCompanyAsync(empresaId, "permissionGroup", new { action = "update", permissionGroup = resposta }, cancellationToken);
        return resposta;
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var grupo = await BuscarAsync(id, empresaId, cancellationToken);
        if (await db.Usuarios.AnyAsync(usuario => usuario.GrupoDePermissaoId == id, cancellationToken))
        {
            throw new AppException(ErroGrupoComUsuarios);
        }

        db.GruposDePermissao.Remove(grupo);
        await db.SaveChangesAsync(cancellationToken);
        await realtime.ToCompanyAsync(empresaId, "permissionGroup", new { action = "delete", permissionGroupId = id.ToString(System.Globalization.CultureInfo.InvariantCulture) }, cancellationToken);
    }

    private async Task<GrupoDePermissao> BuscarAsync(int id, int empresaId, CancellationToken cancellationToken) =>
        await db.GruposDePermissao.FirstOrDefaultAsync(grupo => grupo.Id == id && grupo.EmpresaId == empresaId, cancellationToken)
        ?? throw AppException.NotFound(ErroGrupoNaoEncontrado);

    private static string Serializar(IEnumerable<string> permissoes) =>
        JsonSerializer.Serialize(permissoes.Where(CatalogoDePermissoes.Existe).ToList());
}
