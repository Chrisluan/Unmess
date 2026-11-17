using System.Collections.Concurrent;
using System.Text;

namespace Upu.Core.Registro;

/// <summary>Uma linha do diário, do jeito que o painel a recebe.</summary>
/// <param name="Momento">Quando aconteceu.</param>
/// <param name="Marca">Símbolo curto de estado: →, ✓, ✗, •, ↩, !.</param>
/// <param name="Texto">O que aconteceu, em português.</param>
public sealed record LinhaDeDiario(DateTimeOffset Momento, string Marca, string Texto);

/// <summary>
/// O registro do que o UPU fez, em três lugares ao mesmo tempo.
///
/// Em arquivo, porque a única pergunta que importa depois de uma noite ruim é
/// "o que aconteceu às 3h12". Em memória, porque o painel precisa mostrar as
/// últimas linhas sem reler um arquivo que cresce. E por evento, porque enquanto
/// uma atualização roda o operador fica olhando a tela, e ver o passo mudar em
/// tempo real é a diferença entre esperar e achar que travou.
///
/// Não conseguir gravar o arquivo nunca interrompe uma atualização: log é
/// consequência do trabalho, não condição dele.
/// </summary>
public sealed class Diario
{
    private const int LinhasEmMemoria = 500;

    private readonly string _arquivo;
    private readonly ConcurrentQueue<LinhaDeDiario> _recentes = new();
    private readonly object _travaDeArquivo = new();

    /// <summary>Disparado a cada linha. O painel escuta por SSE.</summary>
    public event Action<LinhaDeDiario>? Escreveu;

    public Diario(string arquivo)
    {
        _arquivo = arquivo;
        Directory.CreateDirectory(Path.GetDirectoryName(arquivo)!);

        // Marca de UTF-8 no começo do arquivo novo.
        //
        // Sem ela, o `Get-Content` do PowerShell e o Bloco de Notas leem o
        // arquivo como ANSI, e "atualização" vira "atualizaÃ§Ã£o" justamente
        // para quem foi ler o log depois de uma noite ruim.
        if (!File.Exists(_arquivo))
        {
            try { File.WriteAllText(_arquivo, "", new UTF8Encoding(true)); }
            catch { /* disco cheio ou sem permissão: o log segue sem a marca */ }
        }
    }

    public void Registrar(string texto, string marca = "  ")
    {
        var linha = new LinhaDeDiario(DateTimeOffset.Now, marca, texto);

        _recentes.Enqueue(linha);
        while (_recentes.Count > LinhasEmMemoria) _recentes.TryDequeue(out _);

        try
        {
            lock (_travaDeArquivo)
            {
                File.AppendAllText(
                    _arquivo,
                    $"{linha.Momento:yyyy-MM-dd HH:mm:ss} {marca} {texto}{Environment.NewLine}");
            }
        }
        catch
        {
            // Disco cheio ou arquivo travado por outro processo. Segue.
        }

        try { Escreveu?.Invoke(linha); }
        catch { /* Um ouvinte quebrado não derruba quem registra. */ }
    }

    public void Passo(string texto) => Registrar(texto, "→");
    public void Ok(string texto) => Registrar(texto, "✓");
    public void Erro(string texto) => Registrar(texto, "✗");
    public void Nota(string texto) => Registrar(texto, "•");
    public void Atencao(string texto) => Registrar(texto, "!");
    public void Volta(string texto) => Registrar(texto, "↩");

    public IReadOnlyList<LinhaDeDiario> Recentes(int quantas = 200) =>
        _recentes.TakeLast(Math.Clamp(quantas, 1, LinhasEmMemoria)).ToList();

    public string Arquivo => _arquivo;
}
