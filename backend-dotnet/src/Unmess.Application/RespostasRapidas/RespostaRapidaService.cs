using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Domain.RespostasRapidas;

namespace Unmess.Application.RespostasRapidas;

public sealed record RespostaRapidaResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("shortcut")] string Atalho,
    [property: JsonPropertyName("message")] string Mensagem,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm,
    [property: JsonPropertyName("companyId")] int? EmpresaId)
{
    public static RespostaRapidaResposta De(RespostaRapida resposta) =>
        new(resposta.Id, resposta.Atalho, resposta.Mensagem, resposta.CriadoEm, resposta.AtualizadoEm, resposta.EmpresaId);
}

public sealed record RespostaRapidaAtualizada(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("shortcut")] string Atalho,
    [property: JsonPropertyName("message")] string Mensagem);

public sealed record ListaDeRespostasRapidas(
    [property: JsonPropertyName("quickAnswers")] IReadOnlyList<RespostaRapidaResposta> RespostasRapidas,
    [property: JsonPropertyName("count")] int Total,
    [property: JsonPropertyName("hasMore")] bool TemMais);

public sealed record DadosDaRespostaRapida
{
    [JsonPropertyName("shortcut")] public string? Atalho { get; init; }
    [JsonPropertyName("message")] public string? Mensagem { get; init; }
}

public sealed class RespostaRapidaService(IUnmessDbContext db, IUsuarioAtual usuarioAtual, IRealtimePublisher realtime)
{
    public const string ErroAtalhoDuplicado = "ERR__SHORTCUT_DUPLICATED";
    public const string ErroNaoEncontradaAoExcluir = "ERR_NO_QUICK_ANSWER_FOUND";
    public const string ErroNaoEncontrada = "ERR_NO_QUICK_ANSWERS_FOUND";

    public async Task<ListaDeRespostasRapidas> ListarAsync(string? busca, string? pagina, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var padrao = $"%{(busca ?? string.Empty).ToLowerInvariant().Trim()}%";
        var consulta = db.RespostasRapidas.AsNoTracking()
            .Where(resposta => resposta.EmpresaId == empresaId && EF.Functions.Like(resposta.Mensagem.ToLower(), padrao));

        var total = await consulta.CountAsync(cancellationToken);
        var deslocamento = Paging.Offset(pagina);
        var itens = await consulta.OrderBy(resposta => resposta.Mensagem).Skip(deslocamento).Take(Paging.PageSize).ToListAsync(cancellationToken);
        return new ListaDeRespostasRapidas(itens.Select(RespostaRapidaResposta.De).ToList(), total, total > deslocamento + itens.Count);
    }

    public async Task<RespostaRapidaResposta> MostrarAsync(int id, CancellationToken cancellationToken) =>
        RespostaRapidaResposta.De(await BuscarAsync(id, usuarioAtual.EmpresaIdObrigatoria(), ErroNaoEncontrada, cancellationToken));

    public async Task<RespostaRapidaResposta> CriarAsync(DadosDaRespostaRapida dados, CancellationToken cancellationToken)
    {
        Validation.Required(dados.Atalho, "shortcut");
        Validation.Required(dados.Mensagem, "message");
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        if (await db.RespostasRapidas.AnyAsync(resposta => resposta.Atalho == dados.Atalho && resposta.EmpresaId == empresaId, cancellationToken))
        {
            throw new AppException(ErroAtalhoDuplicado);
        }

        var respostaRapida = new RespostaRapida { Atalho = dados.Atalho!, Mensagem = dados.Mensagem!, EmpresaId = empresaId };
        db.RespostasRapidas.Add(respostaRapida);
        await db.SaveChangesAsync(cancellationToken);

        var resposta = RespostaRapidaResposta.De(respostaRapida);
        await realtime.ToCompanyAsync(empresaId, "quickAnswer", new { action = "create", quickAnswer = resposta }, cancellationToken);
        return resposta;
    }

    public async Task<RespostaRapidaAtualizada> AtualizarAsync(int id, DadosDaRespostaRapida dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var respostaRapida = await BuscarAsync(id, empresaId, ErroNaoEncontrada, cancellationToken);
        if (dados.Atalho is not null) respostaRapida.Atalho = dados.Atalho;
        if (dados.Mensagem is not null) respostaRapida.Mensagem = dados.Mensagem;
        await db.SaveChangesAsync(cancellationToken);

        var resposta = new RespostaRapidaAtualizada(respostaRapida.Id, respostaRapida.Atalho, respostaRapida.Mensagem);
        await realtime.ToCompanyAsync(empresaId, "quickAnswer", new { action = "update", quickAnswer = resposta }, cancellationToken);
        return resposta;
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        db.RespostasRapidas.Remove(await BuscarAsync(id, empresaId, ErroNaoEncontradaAoExcluir, cancellationToken));
        await db.SaveChangesAsync(cancellationToken);
        await realtime.ToCompanyAsync(empresaId, "quickAnswer", new { action = "delete", quickAnswerId = id.ToString(CultureInfo.InvariantCulture) }, cancellationToken);
    }

    private async Task<RespostaRapida> BuscarAsync(int id, int empresaId, string erro, CancellationToken cancellationToken) =>
        await db.RespostasRapidas.FirstOrDefaultAsync(resposta => resposta.Id == id && resposta.EmpresaId == empresaId, cancellationToken)
        ?? throw AppException.NotFound(erro);
}
