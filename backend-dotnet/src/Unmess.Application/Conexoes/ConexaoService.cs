using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Application.WhatsappGateway;
using Unmess.Domain.Conexoes;

namespace Unmess.Application.Conexoes;

public sealed record FilaDaConexao(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("color")] string Cor,
    [property: JsonPropertyName("greetingMessage")] string? MensagemDeSaudacao);

public sealed record ConexaoResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("number")] string? Numero,
    [property: JsonPropertyName("session")] string? Sessao,
    [property: JsonPropertyName("qrcode")] string? QrCode,
    [property: JsonPropertyName("status")] string? Situacao,
    [property: JsonPropertyName("battery")] string? Bateria,
    [property: JsonPropertyName("plugged")] bool? Carregando,
    [property: JsonPropertyName("retries")] int Tentativas,
    [property: JsonPropertyName("greetingMessage")] string? MensagemDeSaudacao,
    [property: JsonPropertyName("farewellMessage")] string? MensagemDeDespedida,
    [property: JsonPropertyName("isDefault")] bool Padrao,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm,
    [property: JsonPropertyName("companyId")] int? EmpresaId)
{
    [JsonPropertyName("queues")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<FilaDaConexao>? Filas { get; init; }

    public static ConexaoResposta De(ConexaoWhatsapp conexao, bool comFilas = true) => new(
        conexao.Id, conexao.Nome, conexao.Numero, conexao.Sessao, conexao.QrCode, conexao.Situacao, conexao.Bateria, conexao.Carregando,
        conexao.Tentativas, conexao.MensagemDeSaudacao, conexao.MensagemDeDespedida, conexao.Padrao, conexao.CriadoEm, conexao.AtualizadoEm, conexao.EmpresaId)
    {
        Filas = comFilas
            ? conexao.Filas.OrderBy(fila => fila.Nome).Select(fila => new FilaDaConexao(fila.Id, fila.Nome, fila.Cor, fila.MensagemDeSaudacao)).ToList()
            : null
    };
}

public sealed record DadosDaConexao
{
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("status")] public string? Situacao { get; init; }
    [JsonPropertyName("isDefault")] public bool? Padrao { get; init; }
    [JsonPropertyName("greetingMessage")] public string? MensagemDeSaudacao { get; init; }
    [JsonPropertyName("farewellMessage")] public string? MensagemDeDespedida { get; init; }
    [JsonPropertyName("queueIds")] public List<int>? FilaIds { get; init; }
}

public static class SituacoesDaConexao
{
    public const string Abrindo = "OPENING";
    public const string QrCode = "qrcode";
    public const string Conectada = "CONNECTED";
    public const string Desconectada = "DISCONNECTED";
    public const string Duplicada = "DUPLICATED";
}

public sealed class ConexaoService(
    IUnmessDbContext db,
    IUsuarioAtual usuarioAtual,
    IWhatsappGateway gateway,
    IRealtimePublisher realtime,
    ILogger<ConexaoService> logger)
{
    public const string ErroNaoEncontrada = "ERR_NO_WAPP_FOUND";
    public const string ErroSaudacaoObrigatoria = "ERR_WAPP_GREETING_REQUIRED";
    public const string ErroNomeEmUso = "This whatsapp name is already used.";

    public async Task<IReadOnlyList<ConexaoResposta>> ListarAsync(CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var conexoes = await db.ConexoesWhatsapp.AsNoTracking().Include(conexao => conexao.Filas).Where(conexao => conexao.EmpresaId == empresaId).ToListAsync(cancellationToken);
        return conexoes.Select(conexao => ConexaoResposta.De(conexao)).ToList();
    }

    public async Task<ConexaoResposta> MostrarAsync(int id, CancellationToken cancellationToken) =>
        ConexaoResposta.De(await BuscarAsync(id, usuarioAtual.EmpresaIdObrigatoria(), cancellationToken));

    public async Task<ConexaoResposta> CriarAsync(DadosDaConexao dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        Validation.Required(dados.Nome, "name");
        Validation.MinLength(dados.Nome, "name", 2);
        if (await db.ConexoesWhatsapp.AnyAsync(conexao => conexao.Nome == dados.Nome && conexao.EmpresaId == empresaId, cancellationToken))
        {
            throw new AppException(ErroNomeEmUso);
        }

        var primeira = !await db.ConexoesWhatsapp.AnyAsync(conexao => conexao.EmpresaId == empresaId, cancellationToken);
        var filaIds = dados.FilaIds ?? [];
        if (filaIds.Count > 1 && string.IsNullOrEmpty(dados.MensagemDeSaudacao))
        {
            throw new AppException(ErroSaudacaoObrigatoria);
        }

        var conexao = new ConexaoWhatsapp
        {
            Nome = dados.Nome!,
            Situacao = dados.Situacao ?? SituacoesDaConexao.Abrindo,
            MensagemDeSaudacao = dados.MensagemDeSaudacao,
            MensagemDeDespedida = dados.MensagemDeDespedida,
            Padrao = primeira,
            EmpresaId = empresaId,
            Filas = await db.Filas.Where(fila => filaIds.Contains(fila.Id) && fila.EmpresaId == empresaId).ToListAsync(cancellationToken)
        };
        db.ConexoesWhatsapp.Add(conexao);
        await db.SaveChangesAsync(cancellationToken);

        var resposta = ConexaoResposta.De(conexao);
        await realtime.ToCompanyAsync(empresaId, "whatsapp", new { action = "update", whatsapp = resposta }, cancellationToken);
        await IniciarSessaoAsync(conexao, cancellationToken);
        return resposta;
    }

    public async Task<ConexaoResposta> AtualizarAsync(int id, DadosDaConexao dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        Validation.MinLength(dados.Nome, "name", 2);
        if ((dados.FilaIds?.Count ?? 0) > 1 && string.IsNullOrEmpty(dados.MensagemDeSaudacao))
        {
            throw new AppException(ErroSaudacaoObrigatoria);
        }

        ConexaoWhatsapp? antigaPadrao = null;
        if (dados.Padrao == true)
        {
            antigaPadrao = await db.ConexoesWhatsapp.Include(conexao => conexao.Filas)
                .FirstOrDefaultAsync(conexao => conexao.Padrao && conexao.EmpresaId == empresaId && conexao.Id != id, cancellationToken);
            if (antigaPadrao is not null)
            {
                antigaPadrao.Padrao = false;
            }
        }

        var conexao = await BuscarAsync(id, empresaId, cancellationToken);
        if (dados.Nome is not null) conexao.Nome = dados.Nome;
        if (dados.Situacao is not null) conexao.Situacao = dados.Situacao;
        if (dados.MensagemDeSaudacao is not null) conexao.MensagemDeSaudacao = dados.MensagemDeSaudacao;
        if (dados.MensagemDeDespedida is not null) conexao.MensagemDeDespedida = dados.MensagemDeDespedida;
        if (dados.Padrao is not null) conexao.Padrao = dados.Padrao.Value;
        if (dados.FilaIds is not null)
        {
            conexao.Filas.Clear();
            conexao.Filas.AddRange(await db.Filas.Where(fila => dados.FilaIds.Contains(fila.Id) && fila.EmpresaId == empresaId).ToListAsync(cancellationToken));
        }
        await db.SaveChangesAsync(cancellationToken);

        var resposta = ConexaoResposta.De(conexao);
        await realtime.ToCompanyAsync(empresaId, "whatsapp", new { action = "update", whatsapp = resposta }, cancellationToken);
        if (antigaPadrao is not null)
        {
            await realtime.ToCompanyAsync(empresaId, "whatsapp", new { action = "update", whatsapp = ConexaoResposta.De(antigaPadrao) }, cancellationToken);
        }
        return resposta;
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var conexao = await BuscarAsync(id, empresaId, cancellationToken);
        db.ConexoesWhatsapp.Remove(conexao);
        await db.SaveChangesAsync(cancellationToken);
        await ComandoSemFalharAsync(() => gateway.DisconnectAsync(Sessao(id), true, cancellationToken), id);
        await realtime.ToCompanyAsync(empresaId, "whatsapp", new { action = "delete", whatsappId = id }, cancellationToken);
    }

    public async Task IniciarSessaoAsync(int id, CancellationToken cancellationToken) =>
        await IniciarSessaoAsync(await BuscarAsync(id, usuarioAtual.EmpresaIdObrigatoria(), cancellationToken), cancellationToken);

    public async Task NovoQrCodeAsync(int id, CancellationToken cancellationToken)
    {
        var conexao = await BuscarAsync(id, usuarioAtual.EmpresaIdObrigatoria(), cancellationToken);
        conexao.Sessao = string.Empty;
        await db.SaveChangesAsync(cancellationToken);
        await ComandoSemFalharAsync(() => gateway.DisconnectAsync(Sessao(id), true, cancellationToken), id);
        await IniciarSessaoAsync(conexao, cancellationToken);
    }

    public async Task DesconectarAsync(int id, CancellationToken cancellationToken)
    {
        await BuscarAsync(id, usuarioAtual.EmpresaIdObrigatoria(), cancellationToken);
        await ComandoSemFalharAsync(() => gateway.DisconnectAsync(Sessao(id), true, cancellationToken), id);
    }

    public async Task IniciarSessaoAsync(ConexaoWhatsapp conexao, CancellationToken cancellationToken)
    {
        conexao.Situacao = SituacoesDaConexao.Abrindo;
        await db.SaveChangesAsync(cancellationToken);
        await AvisarSessaoAsync(conexao, cancellationToken);
        await ComandoSemFalharAsync(() => gateway.ConnectAsync(Sessao(conexao.Id), cancellationToken), conexao.Id);
    }

    public async Task RetomarTodasAsync(CancellationToken cancellationToken)
    {
        var conexoes = await db.ConexoesWhatsapp.ToListAsync(cancellationToken);
        foreach (var conexao in conexoes)
        {
            try
            {
                var sessao = await gateway.GetSessionAsync(Sessao(conexao.Id), cancellationToken);
                if (sessao.Status == "connected")
                {
                    conexao.Situacao = SituacoesDaConexao.Conectada;
                    conexao.Numero = sessao.PhoneNumber ?? conexao.Numero;
                    conexao.QrCode = string.Empty;
                    await db.SaveChangesAsync(cancellationToken);
                    continue;
                }
            }
            catch (Exception exception) when (exception is HttpRequestException or GatewaySessionUnavailableException)
            {
                logger.LogWarning(exception, "Gateway unavailable while resuming session {WhatsappId}", conexao.Id);
            }

            await IniciarSessaoAsync(conexao, cancellationToken);
        }
    }

    public async Task AplicarSituacaoDoGatewayAsync(int id, string situacao, string? numero, CancellationToken cancellationToken)
    {
        var conexao = await db.ConexoesWhatsapp.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (conexao is null)
        {
            return;
        }

        switch (situacao)
        {
            case "connecting":
                conexao.Situacao = SituacoesDaConexao.Abrindo;
                break;
            case "connected":
                if (await RecusouDuplicadoAsync(conexao, numero ?? string.Empty, cancellationToken))
                {
                    return;
                }
                conexao.Situacao = SituacoesDaConexao.Conectada;
                conexao.QrCode = string.Empty;
                conexao.Numero = numero ?? conexao.Numero;
                conexao.Tentativas = 0;
                break;
            case "needs_qr":
            case "disconnected":
                conexao.Situacao = SituacoesDaConexao.Desconectada;
                conexao.QrCode = string.Empty;
                conexao.Tentativas = 0;
                break;
            default:
                return;
        }

        await db.SaveChangesAsync(cancellationToken);
        await AvisarSessaoAsync(conexao, cancellationToken);
    }

    public async Task AplicarQrCodeAsync(int id, string qr, CancellationToken cancellationToken)
    {
        var conexao = await db.ConexoesWhatsapp.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (conexao is null)
        {
            return;
        }

        conexao.QrCode = qr;
        conexao.Situacao = SituacoesDaConexao.QrCode;
        await db.SaveChangesAsync(cancellationToken);
        await AvisarSessaoAsync(conexao, cancellationToken);
    }

    private async Task<bool> RecusouDuplicadoAsync(ConexaoWhatsapp conexao, string numero, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(numero))
        {
            return false;
        }

        var duplicada = await db.ConexoesWhatsapp.FirstOrDefaultAsync(outra => outra.Numero == numero && outra.EmpresaId == conexao.EmpresaId && outra.Id != conexao.Id, cancellationToken);
        if (duplicada is null)
        {
            return false;
        }

        var recusada = conexao.Id > duplicada.Id ? conexao : duplicada;
        logger.LogWarning("Refused duplicate pairing: number already in use by {Conflicting}", recusada == conexao ? duplicada.Id : conexao.Id);
        recusada.Situacao = SituacoesDaConexao.Duplicada;
        recusada.QrCode = string.Empty;
        recusada.Sessao = string.Empty;
        recusada.Numero = null;
        recusada.Tentativas = 0;
        await db.SaveChangesAsync(cancellationToken);
        await AvisarSessaoAsync(recusada, cancellationToken);
        await ComandoSemFalharAsync(() => gateway.DisconnectAsync(Sessao(recusada.Id), true, cancellationToken), recusada.Id);
        return recusada == conexao;
    }

    private async Task AvisarSessaoAsync(ConexaoWhatsapp conexao, CancellationToken cancellationToken)
    {
        if (conexao.EmpresaId is { } empresaId)
        {
            await realtime.ToCompanyAsync(empresaId, "whatsappSession", new { action = "update", session = ConexaoResposta.De(conexao, comFilas: false) }, cancellationToken);
        }
    }

    private async Task ComandoSemFalharAsync(Func<Task> comando, int id)
    {
        try
        {
            await comando();
        }
        catch (Exception exception) when (exception is HttpRequestException or GatewaySessionUnavailableException or TaskCanceledException)
        {
            logger.LogError(exception, "Gateway command failed for session {WhatsappId}", id);
        }
    }

    private async Task<ConexaoWhatsapp> BuscarAsync(int id, int empresaId, CancellationToken cancellationToken) =>
        await db.ConexoesWhatsapp.Include(conexao => conexao.Filas).FirstOrDefaultAsync(conexao => conexao.Id == id && conexao.EmpresaId == empresaId, cancellationToken)
        ?? throw AppException.NotFound(ErroNaoEncontrada);

    private static string Sessao(int id) => id.ToString(CultureInfo.InvariantCulture);
}
