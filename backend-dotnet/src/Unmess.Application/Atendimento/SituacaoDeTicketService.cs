using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Domain.Atendimento;

namespace Unmess.Application.Atendimento;

public sealed record SituacaoDeTicketResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("color")] string? Cor,
    [property: JsonPropertyName("type")] string Tipo,
    [property: JsonPropertyName("isDefault")] bool Padrao,
    [property: JsonPropertyName("companyId")] int EmpresaId,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm)
{
    public static SituacaoDeTicketResposta De(SituacaoDeTicket situacao) => new(
        situacao.Id, situacao.Nome, situacao.Cor, situacao.Tipo, situacao.Padrao, situacao.EmpresaId, situacao.CriadoEm, situacao.AtualizadoEm);
}

public sealed record DadosDaSituacaoDeTicket
{
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("color")] public string? Cor { get; init; }
    [JsonPropertyName("type")] public string? Tipo { get; init; }
    [JsonPropertyName("isDefault")] public bool? Padrao { get; init; }
}

public sealed class SituacaoDeTicketService(IUnmessDbContext db, IUsuarioAtual usuarioAtual, IRealtimePublisher realtime)
{
    public const string ErroNaoEncontrada = "ERR_NO_TICKET_STATUS_FOUND";
    private static readonly string[] TiposValidos = ["pending", "open", "closed"];

    public async Task<IReadOnlyList<SituacaoDeTicketResposta>> ListarAsync(CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var situacoes = await db.SituacoesDeTicket.AsNoTracking().Where(item => item.EmpresaId == empresaId).OrderBy(item => item.Nome).ToListAsync(cancellationToken);
        return situacoes.Select(SituacaoDeTicketResposta.De).ToList();
    }

    public async Task<SituacaoDeTicketResposta> CriarAsync(DadosDaSituacaoDeTicket dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var tipo = dados.Tipo ?? "closed";
        Validation.Required(dados.Nome, "name");
        Validation.MinLength(dados.Nome, "name", 2);
        if (!TiposValidos.Contains(tipo))
        {
            throw new AppException($"type must be one of the following values: {string.Join(", ", TiposValidos)}");
        }

        var padrao = dados.Padrao ?? false;
        if (padrao)
        {
            await DesmarcarPadraoAsync(empresaId, tipo, null, cancellationToken);
        }

        var situacao = new SituacaoDeTicket { Nome = dados.Nome!, Cor = dados.Cor, Tipo = tipo, Padrao = padrao, EmpresaId = empresaId };
        db.SituacoesDeTicket.Add(situacao);
        await db.SaveChangesAsync(cancellationToken);

        var resposta = SituacaoDeTicketResposta.De(situacao);
        await realtime.ToCompanyAsync(empresaId, "ticketStatus", new { action = "create", ticketStatus = resposta }, cancellationToken);
        return resposta;
    }

    public async Task<SituacaoDeTicketResposta> AtualizarAsync(int id, DadosDaSituacaoDeTicket dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var situacao = await BuscarAsync(id, empresaId, cancellationToken);
        if (dados.Padrao == true)
        {
            await DesmarcarPadraoAsync(empresaId, string.IsNullOrEmpty(dados.Tipo) ? situacao.Tipo : dados.Tipo, null, cancellationToken);
        }

        if (dados.Nome is not null) situacao.Nome = dados.Nome;
        if (dados.Cor is not null) situacao.Cor = dados.Cor;
        if (dados.Tipo is not null) situacao.Tipo = dados.Tipo;
        if (dados.Padrao is not null) situacao.Padrao = dados.Padrao.Value;
        await db.SaveChangesAsync(cancellationToken);

        var resposta = SituacaoDeTicketResposta.De(situacao);
        await realtime.ToCompanyAsync(empresaId, "ticketStatus", new { action = "update", ticketStatus = resposta }, cancellationToken);
        return resposta;
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        db.SituacoesDeTicket.Remove(await BuscarAsync(id, empresaId, cancellationToken));
        await db.SaveChangesAsync(cancellationToken);
        await realtime.ToCompanyAsync(empresaId, "ticketStatus", new { action = "delete", ticketStatusId = id.ToString(CultureInfo.InvariantCulture) }, cancellationToken);
    }

    private Task DesmarcarPadraoAsync(int empresaId, string tipo, int? exceto, CancellationToken cancellationToken) =>
        db.SituacoesDeTicket
            .Where(item => item.EmpresaId == empresaId && item.Tipo == tipo && item.Id != exceto)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.Padrao, false), cancellationToken);

    private async Task<SituacaoDeTicket> BuscarAsync(int id, int empresaId, CancellationToken cancellationToken) =>
        await db.SituacoesDeTicket.FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
        ?? throw AppException.NotFound(ErroNaoEncontrada);
}
