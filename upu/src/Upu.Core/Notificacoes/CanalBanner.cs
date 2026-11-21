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
            GarantirCarregamentoDoWidget(destino);
        }
        finally
        {
            _trava.Release();
        }
    }

    /// <summary>
    /// Confere se a página servida ao usuário carrega o widget, e acrescenta a
    /// linha se faltar.
    ///
    /// Existe porque a alternativa já falhou na prática: a tag estava no
    /// `frontend/index.html` do repositório, mas quem chega ao navegador é o
    /// `build/index.html` gerado pelo vite. Entre editar o fonte e o build
    /// acontecer passaram-se horas em que o UPU publicava avisos que ninguém
    /// via — ele gravava o feed corretamente, e a página não tinha como lê-lo.
    ///
    /// Escrever no build e não no fonte é o certo aqui: o fonte pode voltar
    /// atrás num `reset --hard`, e o build é justamente o que o UPU já mantém.
    /// A cada `vite build` o arquivo nasce de novo sem a tag, e a próxima
    /// publicação a recoloca.
    ///
    /// É idempotente e não toca em nada mais: se a página já cita o widget,
    /// sai sem escrever.
    /// </summary>
    private static void GarantirCarregamentoDoWidget(string destino)
    {
        var pagina = Path.Combine(destino, "index.html");
        if (!File.Exists(pagina)) return;

        string html;
        try { html = File.ReadAllText(pagina); }
        catch { return; }

        if (html.Contains(NomeDoWidget, StringComparison.OrdinalIgnoreCase)) return;

        var fimDoCabecalho = html.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
        if (fimDoCabecalho < 0) return;

        // `defer` para não atrasar a renderização do sistema, e caminho absoluto
        // porque o app tem rotas em vários níveis (`/tickets/42`) e um caminho
        // relativo procuraria o arquivo na pasta errada.
        var tag =
            "<!-- Faixa de avisos do sistema, mantida pelo UPU. -->" +
            $"{Environment.NewLine}    <script src=\"/{NomeDoWidget}\" defer></script>" +
            $"{Environment.NewLine}  ";

        var temporario = pagina + ".novo";

        try
        {
            File.WriteAllText(temporario, html.Insert(fimDoCabecalho, tag));
            File.Move(temporario, pagina, overwrite: true);
        }
        catch
        {
            // Build em andamento segurando o arquivo, por exemplo. A próxima
            // publicação tenta de novo.
            try { File.Delete(temporario); } catch { }
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
