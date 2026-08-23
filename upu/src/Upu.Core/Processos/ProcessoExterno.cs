using System.Diagnostics;
using System.Text;

namespace Upu.Core.Processos;

/// <summary>Resultado de um comando: código de saída e o que ele escreveu.</summary>
/// <param name="Codigo">0 é sucesso; qualquer outro é falha.</param>
/// <param name="Saida">stdout e stderr juntos, na ordem em que apareceram.</param>
/// <param name="Duracao">Quanto levou. Vai para o passo no painel.</param>
public sealed record ResultadoDoProcesso(int Codigo, string Saida, TimeSpan Duracao)
{
    public bool Sucesso => Codigo == 0;

    /// <summary>
    /// A primeira linha que parece um erro, ou a última linha da saída.
    ///
    /// Um `npm run build` que falha escreve centenas de linhas; o painel mostra
    /// uma. Achar a que interessa é o que evita rolar log procurando o motivo.
    /// </summary>
    public string PrimeiraLinhaDeErro()
    {
        var linhas = Saida
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(l => l.TrimEnd('\r').Trim())
            .Where(l => l.Length > 0)
            .ToList();

        if (linhas.Count == 0) return $"o comando terminou com código {Codigo} e sem dizer nada";

        var pistas = new[] { "error", "erro", "failed", "falhou", "cannot", "não foi possível" };

        var suspeita = linhas.FirstOrDefault(l =>
            pistas.Any(p => l.Contains(p, StringComparison.OrdinalIgnoreCase)));

        return suspeita ?? linhas[^1];
    }
}

/// <summary>
/// Roda um programa e espera. Toda conversa do UPU com git, npm e PowerShell
/// passa por aqui.
///
/// Três cuidados que só aparecem quando falta algum deles:
///
///   - stdout e stderr lidos em paralelo, por evento. Ler um depois do outro
///     trava quando o buffer do primeiro enche — e o build do frontend enche.
///   - tempo máximo com morte da árvore de processos. `npm` sobe filhos; matar
///     só o pai deixaria um node segurando a pasta e o próximo build falharia
///     sem explicação.
///   - saída cortada. Guardar 40 MB de log de build em memória, num servidor de
///     8 GB que está atendendo cliente, é pior que perder o meio do texto.
/// </summary>
public static class ProcessoExterno
{
    private const int LimiteDeSaida = 200_000;

    /// <summary>Roda um executável com argumentos separados, sem passar por shell.</summary>
    public static async Task<ResultadoDoProcesso> RodarAsync(
        string programa,
        IEnumerable<string> argumentos,
        string pastaDeTrabalho,
        TimeSpan? limite = null,
        CancellationToken ct = default)
    {
        var inicio = new ProcessStartInfo
        {
            FileName = programa,
            WorkingDirectory = pastaDeTrabalho,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        foreach (var argumento in argumentos) inicio.ArgumentList.Add(argumento);

        return await ExecutarAsync(inicio, limite ?? TimeSpan.FromMinutes(15), ct);
    }

    /// <summary>
    /// Roda uma linha de comando pelo interpretador.
    ///
    /// Necessário para `npm` e `npx`: no Windows eles são arquivos `.cmd`, e o
    /// CreateProcess não sabe executá-los sem o cmd.exe no meio.
    /// </summary>
    public static async Task<ResultadoDoProcesso> RodarNoShellAsync(
        string linhaDeComando,
        string pastaDeTrabalho,
        TimeSpan? limite = null,
        CancellationToken ct = default)
    {
        var inicio = new ProcessStartInfo
        {
            FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe",
            WorkingDirectory = pastaDeTrabalho,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        inicio.ArgumentList.Add("/c");
        inicio.ArgumentList.Add(linhaDeComando);

        return await ExecutarAsync(inicio, limite ?? TimeSpan.FromMinutes(20), ct);
    }

    private static async Task<ResultadoDoProcesso> ExecutarAsync(
        ProcessStartInfo inicio,
        TimeSpan limite,
        CancellationToken ct)
    {
        var relogio = Stopwatch.StartNew();
        var texto = new StringBuilder();
        var travaDoTexto = new object();

        void Acumular(string? linha)
        {
            if (linha is null) return;
            lock (travaDoTexto)
            {
                if (texto.Length < LimiteDeSaida) texto.AppendLine(linha);
            }
        }

        using var processo = new Process { StartInfo = inicio, EnableRaisingEvents = true };

        processo.OutputDataReceived += (_, e) => Acumular(e.Data);
        processo.ErrorDataReceived += (_, e) => Acumular(e.Data);

        processo.Start();
        processo.BeginOutputReadLine();
        processo.BeginErrorReadLine();

        using var prazo = CancellationTokenSource.CreateLinkedTokenSource(ct);
        prazo.CancelAfter(limite);

        try
        {
            await processo.WaitForExitAsync(prazo.Token);
        }
        catch (OperationCanceledException)
        {
            try { processo.Kill(entireProcessTree: true); } catch { }

            var motivo = ct.IsCancellationRequested
                ? "o UPU foi encerrado no meio do comando"
                : $"o comando passou de {limite.TotalMinutes:0} minutos e foi interrompido";

            lock (travaDoTexto) texto.AppendLine(motivo);
            return new ResultadoDoProcesso(-1, texto.ToString(), relogio.Elapsed);
        }

        // Depois do WaitForExit assíncrono ainda pode faltar a última linha nos
        // buffers de leitura; este WaitForExit sem argumento drena os dois.
        processo.WaitForExit();

        string saida;
        lock (travaDoTexto) saida = texto.ToString();

        return new ResultadoDoProcesso(processo.ExitCode, saida, relogio.Elapsed);
    }
}
