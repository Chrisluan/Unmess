using System.Text.Json;
using Upu.Core.Armazenamento;
using Upu.Core.Modelos;

namespace Upu.Core.Notificacoes;

/// <summary>O arquivo que o navegador do usuário lê. É o contrato do widget.</summary>
public sealed class FeedDeAvisos
{
    public DateTimeOffset GeradoEm { get; set; } = DateTimeOffset.Now;

    /// <summary>Versão no ar. O widget mostra no rodapé do banner.</summary>
    public string? VersaoNoAr { get; set; }

    /// <summary>Onde o widget registra a inscrição de push. Veja o comentário abaixo.</summary>
    public string ApiPublica { get; set; } = "/upu";

    /// <summary>Chave pública VAPID, que o navegador precisa para se inscrever.</summary>
    public string? ChaveVapid { get; set; }

    public List<Aviso> Avisos { get; set; } = new();
}

/// <summary>
/// Leva o aviso até a tela do usuário.
///
/// A escolha central aqui é não abrir porta nova: em vez de o navegador do
/// cliente falar com o UPU, o UPU grava um `avisos.json` dentro da mesma pasta
/// que o frontend já serve. O aviso chega pela origem que o usuário já tem
/// aberta — sem CORS, sem certificado novo, sem firewall, e funcionando igual
/// pelo túnel, pelo domínio ou pela rede local.
///
/// Um efeito colateral que precisa de cuidado: `vite build` apaga a pasta de
/// saída inteira. Por isso o executor republica o feed depois de cada
/// compilação do frontend — senão o aviso de "atualizamos" desapareceria
/// exatamente no deploy que o criou.
/// </summary>
public sealed class CanalBanner(string raiz, string pastaPublica, string? pastaDeRecursos)
{
    public const string NomeDoFeed = "avisos.json";
    public const string NomeDoWidget = "avisos-unmess.js";

    private readonly SemaphoreSlim _trava = new(1, 1);

    public string PastaDestino => Path.Combine(raiz, pastaPublica);

    public async Task PublicarAsync(FeedDeAvisos feed, CancellationToken ct = default)
    {
        await _trava.WaitAsync(ct);
        try
        {
            var destino = PastaDestino;
            Directory.CreateDirectory(destino);

            var arquivo = Path.Combine(destino, NomeDoFeed);
            var temporario = arquivo + ".novo";

            await using (var fluxo = File.Create(temporario))
            {
                await JsonSerializer.SerializeAsync(fluxo, feed, Deposito.Json, ct);
            }

            File.Move(temporario, arquivo, overwrite: true);

            GarantirRecursos(destino);
        }
        finally
        {
            _trava.Release();
        }
    }

    /// <summary>
    /// Copia o widget e o service worker para junto do feed, quando faltarem ou
    /// estiverem velhos.
    ///
    /// Ficam aqui, e não no build do frontend, porque precisam continuar
    /// existindo exatamente quando o build do frontend é o que está sendo
    /// trocado — é o widget quem avisa que o sistema vai cair.
    /// </summary>
    private void GarantirRecursos(string destino)
    {
        if (string.IsNullOrWhiteSpace(pastaDeRecursos) || !Directory.Exists(pastaDeRecursos)) return;

        foreach (var origem in Directory.GetFiles(pastaDeRecursos, "*", SearchOption.AllDirectories))
        {
            var relativo = Path.GetRelativePath(pastaDeRecursos, origem);
            var copia = Path.Combine(destino, relativo);

            if (File.Exists(copia) &&
                File.GetLastWriteTimeUtc(copia) >= File.GetLastWriteTimeUtc(origem))
            {
                continue;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(copia)!);
            File.Copy(origem, copia, overwrite: true);
        }
    }
}
