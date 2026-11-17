using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Domain.Configuracoes;

namespace Unmess.Application.Configuracoes;

public sealed record ConfiguracaoResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("key")] string Chave,
    [property: JsonPropertyName("value")] string Valor,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm,
    [property: JsonPropertyName("companyId")] int? EmpresaId)
{
    public static ConfiguracaoResposta De(Configuracao configuracao) => new(
        configuracao.Id, configuracao.Chave, configuracao.Valor, configuracao.CriadoEm, configuracao.AtualizadoEm, configuracao.EmpresaId);
}

public sealed record DadosDaConfiguracao
{
    [JsonPropertyName("value")] public string? Valor { get; init; }
}

public sealed class LeitorDeConfiguracoes(IUnmessDbContext db)
{
    public async Task<string> LerAsync(string chave, int empresaId, string padrao, CancellationToken cancellationToken)
    {
        var valor = await db.Configuracoes.AsNoTracking()
            .Where(item => item.Chave == chave && item.EmpresaId == empresaId)
            .Select(item => item.Valor)
            .FirstOrDefaultAsync(cancellationToken);
        return valor ?? padrao;
    }

    public async Task<bool> LerBooleanoAsync(string chave, int empresaId, bool padrao, CancellationToken cancellationToken)
    {
        var valor = await LerAsync(chave, empresaId, padrao ? "enabled" : "disabled", cancellationToken);
        return valor is "enabled" or "true";
    }

    public async Task<double> LerNumeroAsync(string chave, int empresaId, double padrao, CancellationToken cancellationToken)
    {
        var valor = await LerAsync(chave, empresaId, padrao.ToString(CultureInfo.InvariantCulture), cancellationToken);
        return double.TryParse(valor, NumberStyles.Float, CultureInfo.InvariantCulture, out var numero) && double.IsFinite(numero) ? numero : padrao;
    }
}

public sealed class ConfiguracaoService(
    IUnmessDbContext db,
    IUsuarioAtual usuarioAtual,
    LeitorDeConfiguracoes leitor,
    IRealtimePublisher realtime)
{
    private static readonly IReadOnlyList<(string Chave, string Padrao)> ConfiguracoesDeAtendimento =
    [
        ("signMessages", "enabled"),
        ("notificationSound", "enabled"),
        ("allowAgentSeeAllTickets", "disabled"),
        ("requireClosingStatus", "disabled"),
        ("autoAssignTickets", "disabled")
    ];

    public async Task<IReadOnlyList<ConfiguracaoResposta>> ListarAsync(CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var configuracoes = await db.Configuracoes.AsNoTracking().Where(item => item.EmpresaId == empresaId).ToListAsync(cancellationToken);
        return configuracoes.Select(ConfiguracaoResposta.De).ToList();
    }

    public async Task<IReadOnlyDictionary<string, string>> AtendimentoAsync(CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var resultado = new Dictionary<string, string>();
        foreach (var (chave, padrao) in ConfiguracoesDeAtendimento)
        {
            resultado[chave] = await leitor.LerAsync(chave, empresaId, padrao, cancellationToken);
        }
        return resultado;
    }

    public async Task<ConfiguracaoResposta> AtualizarAsync(string chave, DadosDaConfiguracao dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var configuracao = await db.Configuracoes.FirstOrDefaultAsync(item => item.Chave == chave && item.EmpresaId == empresaId, cancellationToken);
        if (configuracao is null)
        {
            configuracao = new Configuracao { Chave = chave, Valor = dados.Valor ?? string.Empty, EmpresaId = empresaId };
            db.Configuracoes.Add(configuracao);
        }
        else if (dados.Valor is not null)
        {
            configuracao.Valor = dados.Valor;
        }

        await db.SaveChangesAsync(cancellationToken);
        var resposta = ConfiguracaoResposta.De(configuracao);
        await realtime.ToCompanyAsync(empresaId, "settings", new { action = "update", setting = resposta }, cancellationToken);
        return resposta;
    }
}
