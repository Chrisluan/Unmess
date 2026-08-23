using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Upu.Core.Modelos;

namespace Upu.Core.Armazenamento;

/// <summary>
/// Onde o UPU guarda o que sabe: configuração, releases, avisos e inscrições de
/// push, cada um num arquivo JSON dentro de `upu/dados`.
///
/// Por que JSON e não um banco: o UPU vigia a produção, e teria que subir antes
/// dela para poder avisar que ela caiu. Um banco a mais seria uma dependência a
/// mais entre o vigia e o vigiado. O volume também não pede: são dezenas de
/// releases por ano, e uns poucos avisos por vez. Em compensação, dá para abrir
/// no Bloco de Notas às três da manhã e entender o que aconteceu.
///
/// A escrita é atômica (arquivo temporário e troca) porque a máquina pode cair
/// no meio, e um `configuracao.json` truncado tira o painel do ar junto.
/// </summary>
public sealed class Deposito
{
    public static readonly JsonSerializerOptions Json = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        // Sem isto, "atualização" vira "atualização" no arquivo, e o
        // arquivo deixa de ser legível por quem precisa ler.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    private readonly string _pasta;
    private readonly SemaphoreSlim _trava = new(1, 1);

    private Configuracao _configuracao = new();
    private List<Release> _releases = new();
    private List<Aviso> _avisos = new();
    private List<InscricaoPush> _inscricoes = new();

    public Deposito(string pasta)
    {
        _pasta = pasta;
        Directory.CreateDirectory(_pasta);
    }

    public string Pasta => _pasta;

    public Configuracao Configuracao => _configuracao;

    /// <summary>
    /// Arquivos que estavam ilegíveis na carga e foram postos de lado. Vazio no
    /// dia a dia; quando não está, é a explicação para o histórico ter sumido.
    /// </summary>
    public List<string> ArquivosCorrompidos { get; } = new();

    /// <summary>Da mais nova para a mais velha — é a ordem em que o painel lista.</summary>
    public IReadOnlyList<Release> Releases =>
        _releases.OrderByDescending(r => r.CriadaEm).ToList();

    public IReadOnlyList<Aviso> Avisos => _avisos;

    public IReadOnlyList<InscricaoPush> Inscricoes => _inscricoes;

    // ------------------------------------------------------------ carga

    public async Task CarregarAsync(CancellationToken ct = default)
    {
        await _trava.WaitAsync(ct);
        try
        {
            _configuracao = await LerAsync("configuracao.json", new Configuracao(), ct);
            _releases = await LerAsync("releases.json", new List<Release>(), ct);
            _avisos = await LerAsync("avisos.json", new List<Aviso>(), ct);
            _inscricoes = await LerAsync("inscricoes.json", new List<InscricaoPush>(), ct);
        }
        finally
        {
            _trava.Release();
        }
    }

    private async Task<T> LerAsync<T>(string arquivo, T padrao, CancellationToken ct)
    {
        var caminho = Path.Combine(_pasta, arquivo);
        if (!File.Exists(caminho)) return padrao;

        try
        {
            await using var fluxo = File.OpenRead(caminho);
            return await JsonSerializer.DeserializeAsync<T>(fluxo, Json, ct) ?? padrao;
        }
        catch (JsonException erro)
        {
            // Renomear em vez de apagar, e seguir com o padrão em vez de
            // lançar: o arquivo estragado é a única pista do que aconteceu, e
            // um UPU sem histórico ainda é melhor que um UPU que se recusa a
            // subir — ele é quem avisa os usuários quando algo dá errado.
            var quarentena = caminho + $".corrompido-{DateTime.Now:yyyyMMdd-HHmmss}";

            try { File.Move(caminho, quarentena, overwrite: true); }
            catch { /* disco em modo leitura: pior ainda, mas segue */ }

            // O motivo vai junto: "estava ilegível" sem dizer por quê deixa
            // quem editou o arquivo à mão sem saber o que corrigir.
            ArquivosCorrompidos.Add($"{arquivo} — {erro.Message}");
            return padrao;
        }
    }

    // ------------------------------------------------------------ gravação

    private async Task GravarAsync<T>(string arquivo, T valor, CancellationToken ct)
    {
        var destino = Path.Combine(_pasta, arquivo);
        var temporario = destino + ".novo";

        await using (var fluxo = File.Create(temporario))
        {
            await JsonSerializer.SerializeAsync(fluxo, valor, Json, ct);
        }

        File.Move(temporario, destino, overwrite: true);
    }

    public async Task SalvarConfiguracaoAsync(CancellationToken ct = default)
    {
        await _trava.WaitAsync(ct);
        try { await GravarAsync("configuracao.json", _configuracao, ct); }
        finally { _trava.Release(); }
    }

    /// <summary>
    /// Aplica uma mudança na configuração sob a trava, para que duas abas do
    /// painel salvando ao mesmo tempo não percam uma da outra.
    /// </summary>
    public async Task AlterarConfiguracaoAsync(Action<Configuracao> mudanca, CancellationToken ct = default)
    {
        await _trava.WaitAsync(ct);
        try
        {
            mudanca(_configuracao);
            await GravarAsync("configuracao.json", _configuracao, ct);
        }
        finally { _trava.Release(); }
    }

    // ------------------------------------------------------------ releases

    public Release? BuscarRelease(string id) =>
        _releases.FirstOrDefault(r => r.Id == id);

    /// <summary>Versão da última release que chegou ao ar. Nulo se nunca houve.</summary>
    public string? VersaoNoAr =>
        _releases
            .Where(r => r.Estado == EstadoDaRelease.Concluida)
            .OrderByDescending(r => r.ConcluidaEm ?? r.AtualizadaEm)
            .Select(r => r.Versao)
            .FirstOrDefault();

    public Release? ReleaseNoAr =>
        _releases
            .Where(r => r.Estado == EstadoDaRelease.Concluida)
            .OrderByDescending(r => r.ConcluidaEm ?? r.AtualizadaEm)
            .FirstOrDefault();

    /// <summary>Insere ou substitui, e grava.</summary>
    public async Task SalvarReleaseAsync(Release release, CancellationToken ct = default)
    {
        await _trava.WaitAsync(ct);
        try
        {
            release.AtualizadaEm = DateTimeOffset.Now;

            var indice = _releases.FindIndex(r => r.Id == release.Id);
            if (indice >= 0) _releases[indice] = release;
            else _releases.Add(release);

            await GravarAsync("releases.json", _releases, ct);
        }
        finally { _trava.Release(); }
    }

    public async Task RemoverReleaseAsync(string id, CancellationToken ct = default)
    {
        await _trava.WaitAsync(ct);
        try
        {
            _releases.RemoveAll(r => r.Id == id);
            await GravarAsync("releases.json", _releases, ct);
        }
        finally { _trava.Release(); }
    }

    // -------------------------------------------------------------- avisos

    public async Task SalvarAvisoAsync(Aviso aviso, CancellationToken ct = default)
    {
        await _trava.WaitAsync(ct);
        try
        {
            var indice = _avisos.FindIndex(a => a.Id == aviso.Id);
            if (indice >= 0) _avisos[indice] = aviso;
            else _avisos.Add(aviso);

            await GravarAsync("avisos.json", _avisos, ct);
        }
        finally { _trava.Release(); }
    }

    public async Task RemoverAvisoAsync(string id, CancellationToken ct = default)
    {
        await _trava.WaitAsync(ct);
        try
        {
            _avisos.RemoveAll(a => a.Id == id);
            await GravarAsync("avisos.json", _avisos, ct);
        }
        finally { _trava.Release(); }
    }

    /// <summary>
    /// Tira os vencidos. Devolve quantos saíram, para o chamador só republicar o
    /// arquivo do frontend quando algo de fato mudou.
    /// </summary>
    public async Task<int> RemoverAvisosVencidosAsync(DateTimeOffset agora, CancellationToken ct = default)
    {
        await _trava.WaitAsync(ct);
        try
        {
            var removidos = _avisos.RemoveAll(a => !a.EstaValido(agora));
            if (removidos > 0) await GravarAsync("avisos.json", _avisos, ct);
            return removidos;
        }
        finally { _trava.Release(); }
    }

    /// <summary>
    /// Remove avisos de uma release — o aviso prévio some quando a atualização
    /// termina, para não conviver com o "já atualizou".
    /// </summary>
    public async Task RemoverAvisosDaReleaseAsync(string releaseId, CancellationToken ct = default)
    {
        await _trava.WaitAsync(ct);
        try
        {
            if (_avisos.RemoveAll(a => a.ReleaseId == releaseId) > 0)
                await GravarAsync("avisos.json", _avisos, ct);
        }
        finally { _trava.Release(); }
    }

    // ---------------------------------------------------------- inscrições

    public async Task SalvarInscricaoAsync(InscricaoPush inscricao, CancellationToken ct = default)
    {
        await _trava.WaitAsync(ct);
        try
        {
            var indice = _inscricoes.FindIndex(i => i.Endpoint == inscricao.Endpoint);
            if (indice >= 0) _inscricoes[indice] = inscricao;
            else _inscricoes.Add(inscricao);

            await GravarAsync("inscricoes.json", _inscricoes, ct);
        }
        finally { _trava.Release(); }
    }

    public async Task RemoverInscricoesAsync(IEnumerable<string> endpoints, CancellationToken ct = default)
    {
        var alvo = endpoints.ToHashSet(StringComparer.Ordinal);
        if (alvo.Count == 0) return;

        await _trava.WaitAsync(ct);
        try
        {
            if (_inscricoes.RemoveAll(i => alvo.Contains(i.Endpoint)) > 0)
                await GravarAsync("inscricoes.json", _inscricoes, ct);
        }
        finally { _trava.Release(); }
    }
}
