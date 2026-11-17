using Upu.Core.Modelos;

namespace Upu.Core.Deploy;

/// <summary>
/// O que estava no ar antes, guardado para poder voltar.
///
/// Guarda só o resultado da compilação — `backend\dist` e `frontend\build` — e o
/// sha do commit anterior. O código-fonte não é copiado: ele volta com um
/// `git reset` para aquele commit, que é mais confiável e infinitamente mais
/// barato que copiar a árvore inteira num disco que também está servindo o
/// atendimento.
///
/// Fica em `.reserva-deploy`, na raiz — a mesma pasta que o atualizador anterior
/// usava, já ignorada pelo git. Duas ferramentas escrevendo no mesmo lugar seria
/// problema se as duas rodassem juntas; elas não rodam, e o UPU recusa começar
/// se encontrar uma reserva de alguém que ainda está trabalhando.
/// </summary>
public sealed class Reserva(string raiz)
{
    public string Pasta { get; } = Path.Combine(raiz, ".reserva-deploy");

    private string ArquivoDoCommit => Path.Combine(Pasta, "commit.txt");

    public bool Existe => Directory.Exists(Pasta) && File.Exists(ArquivoDoCommit);

    /// <summary>Copia as saídas de build atuais e anota o commit que está no ar.</summary>
    public void Guardar(string commitAtual, IEnumerable<ServicoGerenciado> servicos)
    {
        Descartar();
        Directory.CreateDirectory(Pasta);

        foreach (var servico in servicos)
        {
            var origem = Path.Combine(raiz, servico.PastaDeSaida);
            if (!Directory.Exists(origem)) continue;

            CopiarPasta(origem, Path.Combine(Pasta, servico.Id));
        }

        File.WriteAllText(ArquivoDoCommit, commitAtual);
    }

    /// <summary>
    /// Devolve o build anterior para o lugar. Quem chama ainda precisa resetar o
    /// git e reiniciar os serviços — a ordem importa, e é o executor que a
    /// conhece.
    /// </summary>
    /// <returns>O commit para o qual voltar.</returns>
    public string Restaurar(IEnumerable<ServicoGerenciado> servicos)
    {
        if (!Existe)
            throw new InvalidOperationException("não há reserva guardada para restaurar");

        foreach (var servico in servicos)
        {
            var guardado = Path.Combine(Pasta, servico.Id);
            if (!Directory.Exists(guardado)) continue;

            var destino = Path.Combine(raiz, servico.PastaDeSaida);

            if (Directory.Exists(destino)) Directory.Delete(destino, recursive: true);
            CopiarPasta(guardado, destino);
        }

        return File.ReadAllText(ArquivoDoCommit).Trim();
    }

    /// <summary>
    /// Apaga a reserva. Só depois de a nova versão passar na conferência de
    /// saúde: enquanto houver dúvida, a reserva é a única saída.
    /// </summary>
    public void Descartar()
    {
        if (Directory.Exists(Pasta)) Directory.Delete(Pasta, recursive: true);
    }

    private static void CopiarPasta(string origem, string destino)
    {
        Directory.CreateDirectory(destino);

        foreach (var pasta in Directory.GetDirectories(origem, "*", SearchOption.AllDirectories))
        {
            Directory.CreateDirectory(pasta.Replace(origem, destino));
        }

        foreach (var arquivo in Directory.GetFiles(origem, "*", SearchOption.AllDirectories))
        {
            File.Copy(arquivo, arquivo.Replace(origem, destino), overwrite: true);
        }
    }
}
