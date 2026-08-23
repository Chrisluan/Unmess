using Upu.Core.Processos;

namespace Upu.Core.Git;

/// <summary>Um commit, do jeito que o painel precisa mostrar.</summary>
public sealed record CommitResumido(
    string Sha,
    string Curto,
    string Assunto,
    string Autor,
    DateTimeOffset Data);

/// <summary>Erro vindo do git, já com a saída dele junto.</summary>
public sealed class ErroDeGit(string mensagem) : Exception(mensagem);

/// <summary>
/// A conversa do UPU com o repositório da instalação.
///
/// Trabalha por processo, chamando o `git.exe`, e não por biblioteca: é o mesmo
/// git que a pessoa usaria pelo terminal na máquina, com a mesma configuração,
/// as mesmas credenciais e o mesmo resultado. Uma biblioteca teria a sua própria
/// ideia de autenticação, e descobrir isso no meio de um deploy é caro.
/// </summary>
public sealed class Repositorio(string raiz)
{
    public string Raiz { get; } = raiz;

    private async Task<string> GitAsync(params string[] argumentos)
    {
        var r = await ProcessoExterno.RodarAsync("git", argumentos, Raiz, TimeSpan.FromMinutes(10));

        if (!r.Sucesso)
        {
            throw new ErroDeGit(
                $"git {string.Join(' ', argumentos)} falhou: {r.PrimeiraLinhaDeErro()}");
        }

        return r.Saida.Trim();
    }

    private async Task<(bool Sucesso, string Saida)> TentarGitAsync(params string[] argumentos)
    {
        var r = await ProcessoExterno.RodarAsync("git", argumentos, Raiz, TimeSpan.FromMinutes(10));
        return (r.Sucesso, r.Saida.Trim());
    }

    /// <summary>
    /// Há trabalho não commitado nesta máquina?
    ///
    /// A atualização usa `reset --hard`. Se alguém estiver editando algo aqui —
    /// e neste servidor isso acontece — o reset apaga sem avisar. Por isso a
    /// atualização para antes de começar em vez de destruir.
    /// </summary>
    public async Task<bool> ArvoreLimpaAsync() =>
        (await GitAsync("status", "--porcelain")).Length == 0;

    /// <summary>O que exatamente está sujo, para o painel poder mostrar.</summary>
    public async Task<IReadOnlyList<string>> AlteracoesPendentesAsync()
    {
        var saida = await GitAsync("status", "--porcelain");
        return saida
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(l => l.TrimEnd('\r'))
            .ToList();
    }

    public Task BuscarAsync(string branch) =>
        GitAsync("fetch", "origin", branch, "--quiet");

    public Task<string> CommitAtualAsync() => GitAsync("rev-parse", "HEAD");

    public Task<string> CommitRemotoAsync(string branch) =>
        GitAsync("rev-parse", $"origin/{branch}");

    public async Task<string> BranchAtualAsync() =>
        await GitAsync("rev-parse", "--abbrev-ref", "HEAD");

    /// <summary>Uma linha só: `a1b2c3d assunto (autor, há 2 horas)`.</summary>
    public Task<string> ResumoAsync(string referencia) =>
        GitAsync("log", "-1", "--pretty=%h %s (%an, %ar)", referencia);

    /// <summary>
    /// Os commits que existem em `para` e não em `de` — o que este deploy leva.
    ///
    /// O painel mostra a lista antes de deixar preencher a release: é olhando
    /// para ela que o operador escreve o resumo para os usuários.
    /// </summary>
    public async Task<IReadOnlyList<CommitResumido>> CommitsEntreAsync(string de, string para)
    {
        // O separador em barra vertical dupla evita o problema óbvio: mensagem
        // de commit com ponto e vírgula ou tabulação dentro.
        var saida = await GitAsync(
            "log", "--pretty=%H||%h||%s||%an||%aI", $"{de}..{para}");

        var commits = new List<CommitResumido>();

        foreach (var linha in saida.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var partes = linha.TrimEnd('\r').Split("||");
            if (partes.Length < 5) continue;

            commits.Add(new CommitResumido(
                partes[0],
                partes[1],
                partes[2],
                partes[3],
                DateTimeOffset.TryParse(partes[4], out var data) ? data : DateTimeOffset.Now));
        }

        return commits;
    }

    /// <summary>Arquivos tocados entre dois commits.</summary>
    public async Task<IReadOnlyList<string>> ArquivosAlteradosAsync(string de, string para)
    {
        var saida = await GitAsync("diff", "--name-only", $"{de}..{para}");
        return saida
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(l => l.TrimEnd('\r'))
            .Where(l => l.Length > 0)
            .ToList();
    }

    /// <summary>
    /// O commit está mesmo na branch de produção?
    ///
    /// A release congela um sha escolhido no painel. Entre escolher e aplicar
    /// pode ter havido um force-push que jogou aquele commit fora — e aplicar
    /// um commit que não está mais na branch é publicar código que ninguém
    /// revisou.
    /// </summary>
    public async Task<bool> CommitPertenceAoBranchAsync(string sha, string branch)
    {
        // `--is-ancestor` sai com 0 para "sim", 1 para "não" e 128 para commit
        // desconhecido. Os dois últimos significam a mesma coisa aqui: não vai
        // ser aplicado. O commit é ancestral de si mesmo, então a ponta da
        // branch também passa.
        var (sucesso, _) = await TentarGitAsync(
            "merge-base", "--is-ancestor", sha, $"origin/{branch}");

        return sucesso;
    }

    /// <summary>Expande `a1b2c3d` para o sha inteiro; devolve nulo se não existir.</summary>
    public async Task<string?> ExpandirShaAsync(string sha)
    {
        var (sucesso, saida) = await TentarGitAsync("rev-parse", "--verify", $"{sha}^{{commit}}");
        return sucesso ? saida : null;
    }

    /// <summary>
    /// Deixa a árvore idêntica ao commit pedido.
    ///
    /// O `reset --hard` é o ponto do UPU em que não há volta pela metade: ou a
    /// instalação fica igual ao que está no GitHub, ou não fica. Resquício de
    /// merge e arquivo editado à mão no servidor são exatamente o que produz o
    /// "aqui funciona diferente" que ninguém consegue reproduzir.
    /// </summary>
    public async Task SincronizarComAsync(string branch, string sha)
    {
        await GitAsync("checkout", branch, "--quiet");
        await GitAsync("reset", "--hard", sha, "--quiet");
    }

    public Task ResetarParaAsync(string sha) => GitAsync("reset", "--hard", sha, "--quiet");
}
