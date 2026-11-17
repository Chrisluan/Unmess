using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Domain.Filas;

namespace Unmess.Application.Filas;

public sealed record FilaResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("color")] string Cor,
    [property: JsonPropertyName("greetingMessage")] string? MensagemDeSaudacao,
    [property: JsonPropertyName("isDefault")] bool Padrao,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm,
    [property: JsonPropertyName("companyId")] int? EmpresaId)
{
    public static FilaResposta De(Fila fila) => new(
        fila.Id, fila.Nome, fila.Cor, fila.MensagemDeSaudacao, fila.Padrao, fila.CriadoEm, fila.AtualizadoEm, fila.EmpresaId);
}

public sealed record DadosDaFila
{
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("color")] public string? Cor { get; init; }
    [JsonPropertyName("greetingMessage")] public string? MensagemDeSaudacao { get; init; }
    [JsonPropertyName("isDefault")] public bool? Padrao { get; init; }
}

public sealed partial class FilaService(IUnmessDbContext db, IUsuarioAtual usuarioAtual, IRealtimePublisher realtime)
{
    public const string ErroNomeInvalido = "ERR_QUEUE_INVALID_NAME";
    public const string ErroNomeDuplicado = "ERR_QUEUE_NAME_ALREADY_EXISTS";
    public const string ErroCorInvalida = "ERR_QUEUE_INVALID_COLOR";
    public const string ErroNaoEncontrada = "ERR_QUEUE_NOT_FOUND";

    [GeneratedRegex("^#[0-9a-f]{3,6}$", RegexOptions.IgnoreCase)]
    private static partial Regex CorValida();

    public async Task<IReadOnlyList<FilaResposta>> ListarAsync(CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var filas = await db.Filas.AsNoTracking().Where(fila => fila.EmpresaId == empresaId).OrderBy(fila => fila.Nome).ToListAsync(cancellationToken);
        return filas.Select(FilaResposta.De).ToList();
    }

    public async Task<FilaResposta> MostrarAsync(int id, CancellationToken cancellationToken) =>
        FilaResposta.De(await BuscarAsync(id, usuarioAtual.EmpresaIdObrigatoria(), cancellationToken));

    public async Task<FilaResposta> CriarAsync(DadosDaFila dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        if (string.IsNullOrEmpty(dados.Nome) || dados.Nome.Length < 2)
        {
            throw new AppException(ErroNomeInvalido);
        }
        if (await db.Filas.AnyAsync(fila => fila.Nome == dados.Nome && fila.EmpresaId == empresaId, cancellationToken))
        {
            throw new AppException(ErroNomeDuplicado);
        }
        if (string.IsNullOrEmpty(dados.Cor) || !CorValida().IsMatch(dados.Cor))
        {
            throw new AppException(ErroCorInvalida);
        }

        var fila = new Fila { Nome = dados.Nome, Cor = dados.Cor, MensagemDeSaudacao = dados.MensagemDeSaudacao, EmpresaId = empresaId };
        db.Filas.Add(fila);
        await db.SaveChangesAsync(cancellationToken);

        var resposta = FilaResposta.De(fila);
        await realtime.ToCompanyAsync(empresaId, "queue", new { action = "update", queue = resposta }, cancellationToken);
        return resposta;
    }

    public async Task<FilaResposta> AtualizarAsync(int id, DadosDaFila dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        if (dados.Nome is not null && dados.Nome.Length < 2)
        {
            throw new AppException(ErroNomeInvalido);
        }
        if (!string.IsNullOrEmpty(dados.Nome) &&
            await db.Filas.AnyAsync(fila => fila.Nome == dados.Nome && fila.EmpresaId == empresaId && fila.Id != id, cancellationToken))
        {
            throw new AppException(ErroNomeDuplicado);
        }
        if (string.IsNullOrEmpty(dados.Cor) || !CorValida().IsMatch(dados.Cor))
        {
            throw new AppException(ErroCorInvalida);
        }

        var fila = await BuscarAsync(id, empresaId, cancellationToken);
        if (dados.Padrao == true)
        {
            await db.Filas.Where(outra => outra.EmpresaId == empresaId && outra.Id != id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(outra => outra.Padrao, false), cancellationToken);
        }

        if (dados.Nome is not null) fila.Nome = dados.Nome;
        fila.Cor = dados.Cor;
        if (dados.MensagemDeSaudacao is not null) fila.MensagemDeSaudacao = dados.MensagemDeSaudacao;
        if (dados.Padrao is not null) fila.Padrao = dados.Padrao.Value;
        await db.SaveChangesAsync(cancellationToken);

        var resposta = FilaResposta.De(fila);
        await realtime.ToCompanyAsync(empresaId, "queue", new { action = "update", queue = resposta }, cancellationToken);
        return resposta;
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var fila = await BuscarAsync(id, empresaId, cancellationToken);
        db.Filas.Remove(fila);
        await db.SaveChangesAsync(cancellationToken);
        await realtime.ToCompanyAsync(empresaId, "queue", new { action = "delete", queueId = id }, cancellationToken);
    }

    private async Task<Fila> BuscarAsync(int id, int empresaId, CancellationToken cancellationToken) =>
        await db.Filas.FirstOrDefaultAsync(fila => fila.Id == id && fila.EmpresaId == empresaId, cancellationToken)
        ?? throw new AppException(ErroNaoEncontrada);
}
