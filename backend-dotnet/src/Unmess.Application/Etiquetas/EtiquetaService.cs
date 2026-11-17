using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Domain.Etiquetas;

namespace Unmess.Application.Etiquetas;

public sealed record EtiquetaResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("color")] string Cor,
    [property: JsonPropertyName("companyId")] int EmpresaId,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm)
{
    public static EtiquetaResposta De(Etiqueta etiqueta) =>
        new(etiqueta.Id, etiqueta.Nome, etiqueta.Cor, etiqueta.EmpresaId, etiqueta.CriadoEm, etiqueta.AtualizadoEm);
}

public sealed record DadosDaEtiqueta
{
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("color")] public string? Cor { get; init; }
}

public sealed class EtiquetaService(IUnmessDbContext db, IUsuarioAtual usuarioAtual, IRealtimePublisher realtime)
{
    public const string ErroNomeDuplicado = "ERR_TAG_DUPLICATED_NAME";
    public const string ErroNaoEncontrada = "ERR_NO_TAG_FOUND";
    public const int TamanhoMaximoDoNome = 40;

    public async Task<IReadOnlyList<EtiquetaResposta>> ListarAsync(string? busca, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var consulta = db.Etiquetas.AsNoTracking().Where(etiqueta => etiqueta.EmpresaId == empresaId);
        if (!string.IsNullOrEmpty(busca))
        {
            consulta = consulta.Where(etiqueta => EF.Functions.Like(etiqueta.Nome, $"%{busca}%"));
        }

        var etiquetas = await consulta.OrderBy(etiqueta => etiqueta.Nome).ToListAsync(cancellationToken);
        return etiquetas.Select(EtiquetaResposta.De).ToList();
    }

    public async Task<EtiquetaResposta> CriarAsync(DadosDaEtiqueta dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        Validation.Required(dados.Nome, "name");
        if (dados.Nome!.Length > TamanhoMaximoDoNome)
        {
            throw new AppException($"name must be at most {TamanhoMaximoDoNome} characters");
        }
        if (await db.Etiquetas.AnyAsync(etiqueta => etiqueta.Nome == dados.Nome && etiqueta.EmpresaId == empresaId, cancellationToken))
        {
            throw new AppException(ErroNomeDuplicado);
        }

        var etiqueta = new Etiqueta { Nome = dados.Nome, Cor = string.IsNullOrEmpty(dados.Cor) ? "#2ecc71" : dados.Cor, EmpresaId = empresaId };
        db.Etiquetas.Add(etiqueta);
        await db.SaveChangesAsync(cancellationToken);

        var resposta = EtiquetaResposta.De(etiqueta);
        await realtime.ToCompanyAsync(empresaId, "tag", new { action = "create", tag = resposta }, cancellationToken);
        return resposta;
    }

    public async Task<EtiquetaResposta> AtualizarAsync(int id, DadosDaEtiqueta dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var etiqueta = await BuscarAsync(id, empresaId, cancellationToken);
        if (!string.IsNullOrEmpty(dados.Nome) && dados.Nome != etiqueta.Nome &&
            await db.Etiquetas.AnyAsync(outra => outra.Nome == dados.Nome && outra.EmpresaId == empresaId && outra.Id != id, cancellationToken))
        {
            throw new AppException(ErroNomeDuplicado);
        }

        if (dados.Nome is not null) etiqueta.Nome = dados.Nome;
        if (dados.Cor is not null) etiqueta.Cor = dados.Cor;
        await db.SaveChangesAsync(cancellationToken);

        var resposta = EtiquetaResposta.De(etiqueta);
        await realtime.ToCompanyAsync(empresaId, "tag", new { action = "update", tag = resposta }, cancellationToken);
        return resposta;
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        db.Etiquetas.Remove(await BuscarAsync(id, empresaId, cancellationToken));
        await db.SaveChangesAsync(cancellationToken);
        await realtime.ToCompanyAsync(empresaId, "tag", new { action = "delete", tagId = id }, cancellationToken);
    }

    private async Task<Etiqueta> BuscarAsync(int id, int empresaId, CancellationToken cancellationToken) =>
        await db.Etiquetas.FirstOrDefaultAsync(etiqueta => etiqueta.Id == id && etiqueta.EmpresaId == empresaId, cancellationToken)
        ?? throw AppException.NotFound(ErroNaoEncontrada);
}
