using Upu.Core.Processos;

namespace Upu.Core.Deploy;

/// <summary>Estado de um serviço do Windows, como o painel mostra.</summary>
public sealed record EstadoDoServico(string Nome, bool Instalado, string Estado)
{
    public bool Rodando => string.Equals(Estado, "Running", StringComparison.OrdinalIgnoreCase);
}

/// <summary>
/// Para e sobe os serviços da instalação.
///
/// Pelo PowerShell, e não pelo ServiceController do .NET, por dois motivos
/// práticos: é exatamente o comando que já se usa nesta máquina há meses, com o
/// mesmo comportamento diante do NSSM (que é quem hospeda o node de verdade); e
/// mantém o UPU sem nenhum pacote de fora, o que importa num servidor que
/// compila a própria atualização.
///
/// O nome do serviço nunca chega aqui vindo da rede: vem da configuração, que
/// só muda por quem tem acesso ao arquivo ou ao painel autenticado.
/// </summary>
public sealed class ControleDeServico
{
    private static readonly TimeSpan EsperaMaxima = TimeSpan.FromSeconds(90);

    private static async Task<ResultadoDoProcesso> PowerShellAsync(
        string comando, CancellationToken ct)
    {
        return await ProcessoExterno.RodarAsync(
            "powershell.exe",
            new[] { "-NoProfile", "-NonInteractive", "-Command", comando },
            Environment.SystemDirectory,
            TimeSpan.FromMinutes(3),
            ct);
    }

    /// <summary>
    /// Reinicia e espera o serviço voltar a "Running".
    ///
    /// Lança se não voltar: quem chama precisa decidir se desfaz tudo, e um
    /// retorno booleano ignorado silenciosamente é como um deploy quebrado
    /// passa despercebido.
    /// </summary>
    public async Task ReiniciarAsync(string servico, CancellationToken ct = default)
    {
        var comando =
            "$ErrorActionPreference='Stop'; " +
            $"try {{ Restart-Service -Name '{Escapar(servico)}'; " +
            $"(Get-Service '{Escapar(servico)}')." +
            $"WaitForStatus('Running',(New-TimeSpan -Seconds {(int)EsperaMaxima.TotalSeconds})); " +
            "'ok' } catch { 'falha: ' + $_.Exception.Message }";

        var r = await PowerShellAsync(comando, ct);
        var saida = r.Saida.Trim();

        if (!saida.StartsWith("ok", StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"não consegui reiniciar {servico}: " +
                (saida.Length > 0 ? saida : r.PrimeiraLinhaDeErro()));
        }
    }

    public async Task<EstadoDoServico> ConsultarAsync(string servico, CancellationToken ct = default)
    {
        var comando =
            "$ErrorActionPreference='SilentlyContinue'; " +
            $"$s = Get-Service -Name '{Escapar(servico)}'; " +
            "if ($s) { $s.Status.ToString() } else { 'ausente' }";

        var r = await PowerShellAsync(comando, ct);
        var estado = r.Saida.Trim();

        return estado is "ausente" or ""
            ? new EstadoDoServico(servico, false, "ausente")
            : new EstadoDoServico(servico, true, estado);
    }

    /// <summary>
    /// Aspas simples do PowerShell dobram para escapar. O nome vem da
    /// configuração e não da rede, mas um serviço chamado `o'brien` quebraria o
    /// comando por acidente — e acidente também derruba produção.
    /// </summary>
    private static string Escapar(string valor) => valor.Replace("'", "''");
}
