using Upu.Core.Armazenamento;
using Upu.Core.Git;
using Upu.Core.Modelos;
using Upu.Core.Notificacoes;
using Upu.Core.Registro;
using Upu.Core.Processos;
using Upu.Core.Validacao;

namespace Upu.Core.Deploy;

/// <summary>Erro que já é a explicação: vai inteiro para o painel.</summary>
public sealed class ErroDeAtualizacao(string mensagem) : Exception(mensagem);

/// <summary>
/// Aplica uma release em produção, do jeito que dá para dormir depois.
///
/// A ordem dos passos é a parte importante, e cada inversão dela já custou uma
/// noite em algum lugar:
///
///   1. Recusa começar com trabalho não commitado na máquina. O `reset --hard`
///      apagaria sem perguntar.
///   2. Avisa os usuários ANTES de mexer em qualquer coisa.
///   3. Guarda o que está no ar. É o que torna a volta possível.
///   4. Compila ANTES de tocar nos serviços. Código que não compila nunca chega
///      a interromper o atendimento.
///   5. Reinicia e confere a porta. Serviço "Running" não prova nada; só
///      alguém escutando na porta prova.
///   6. Se algo falhar em qualquer ponto, desfaz sozinho e avisa. Um deploy
///      quebrado às três da manhã se resolve sem acordar ninguém.
///
/// E o passo zero, que é o motivo de o UPU existir: valida de novo os campos
/// obrigatórios, aqui dentro, um instante antes de aplicar. Entre agendar e
/// aplicar pode passar uma noite inteira, e nesse meio-tempo a versão no ar
/// pode ter mudado por outro caminho.
/// </summary>
public sealed class Executor(
    Deposito deposito,
    Repositorio repositorio,
    ControleDeServico controleDeServico,
    SondaDeSaude sonda,
    Publicador publicador,
    Diario diario)
{
    private readonly SemaphoreSlim _umaPorVez = new(1, 1);

    /// <summary>Release rodando agora, ou nulo. O painel usa para travar botões.</summary>
    public Release? EmAndamento { get; private set; }

    // ------------------------------------------------------------- diagnóstico

    /// <summary>O que muda se esta release for aplicada. Alimenta o painel.</summary>
    public sealed record Previsao(
        string CommitAtual,
        string CommitAlvo,
        IReadOnlyList<CommitResumido> Commits,
        IReadOnlyList<string> ServicosQueRecompilam,
        IReadOnlyList<string> ServicosComDependenciasNovas,
        bool SemNovidade);

    public async Task<Previsao> PreverAsync(string commitAlvo, CancellationToken ct = default)
    {
        var configuracao = deposito.Configuracao;

        await repositorio.BuscarAsync(configuracao.Branch);

        var atual = await repositorio.CommitAtualAsync();
        var alvo = await repositorio.ExpandirShaAsync(commitAlvo)
            ?? throw new ErroDeAtualizacao($"o commit {commitAlvo} não existe neste repositório");

        var mesmoCommit = string.Equals(atual, alvo, StringComparison.OrdinalIgnoreCase);

        var alterados = mesmoCommit
            ? Array.Empty<string>()
            : (await repositorio.ArquivosAlteradosAsync(atual, alvo)).ToArray();

        var recompilam = configuracao.Servicos
            .Where(s => alterados.Any(a => a.StartsWith(s.Prefixo, StringComparison.OrdinalIgnoreCase)))
            .Select(s => s.Id)
            .ToList();

        var dependencias = configuracao.Servicos
            .Where(s => alterados.Any(a =>
                a.Equals($"{s.Prefixo}package.json", StringComparison.OrdinalIgnoreCase) ||
                a.Equals($"{s.Prefixo}package-lock.json", StringComparison.OrdinalIgnoreCase)))
            .Select(s => s.Id)
            .ToList();

        var commits = mesmoCommit
            ? Array.Empty<CommitResumido>()
            : (await repositorio.CommitsEntreAsync(atual, alvo)).ToArray();

        return new Previsao(atual, alvo, commits, recompilam, dependencias, mesmoCommit);
    }

    // ---------------------------------------------------------------- aplicar

    /// <summary>
    /// Aplica a release. Devolve a mesma instância, já com estado e passos.
    /// </summary>
    public async Task<Release> AplicarAsync(Release release, CancellationToken ct = default)
    {
        if (!await _umaPorVez.WaitAsync(0, ct))
        {
            throw new ErroDeAtualizacao(
                "já há uma atualização em andamento. Duas ao mesmo tempo se " +
                "sobrescreveriam no meio do build.");
        }

        EmAndamento = release;

        try
        {
            return await AplicarInternoAsync(release, ct);
        }
        finally
        {
            EmAndamento = null;
            _umaPorVez.Release();
        }
    }

    private async Task<Release> AplicarInternoAsync(Release release, CancellationToken ct)
    {
        var configuracao = deposito.Configuracao;
        var reserva = new Reserva(configuracao.Raiz);

        release.Estado = EstadoDaRelease.Aplicando;
        release.IniciadaEm = DateTimeOffset.Now;
        release.Falha = null;
        release.Passos.Clear();
        await deposito.SalvarReleaseAsync(release, ct);

        diario.Registrar(new string('=', 58));
        diario.Passo($"aplicando a versão {release.Versao} — {release.Titulo}");

        try
        {
            // ------------------------------------------------ portão dos campos

            await ExecutarPassoAsync(release, "conferir os campos obrigatórios", async () =>
            {
                var erros = ValidadorDeRelease.Validar(
                    release, deposito.VersaoNoAr, DateTimeOffset.Now);

                // A janela já passou quando chega aqui — é justamente a hora de
                // aplicar. Esse erro específico não conta.
                erros = erros.Where(e => e.Campo != "janela").ToList();

                if (erros.Count > 0)
                {
                    throw new ErroDeAtualizacao(
                        "a release não está completa: " +
                        string.Join("; ", erros.Select(e => $"{e.Campo} — {e.Mensagem}")));
                }

                await Task.CompletedTask;
                return $"{release.Alteracoes.Count} alteração(ões), impacto {release.Impacto}";
            }, ct);

            // ------------------------------------------------------ repositório

            await ExecutarPassoAsync(release, "conferir a árvore de trabalho", async () =>
            {
                var pendentes = await repositorio.AlteracoesPendentesAsync();
                if (pendentes.Count > 0)
                {
                    throw new ErroDeAtualizacao(
                        $"há {pendentes.Count} alteração(ões) não commitada(s) nesta máquina " +
                        $"(ex.: {pendentes[0]}). A atualização usa reset --hard e apagaria " +
                        "esse trabalho, então parei antes.");
                }

                return "limpa";
            }, ct);

            await ExecutarPassoAsync(release, $"buscar a branch {configuracao.Branch}", async () =>
            {
                await repositorio.BuscarAsync(configuracao.Branch);
                return await repositorio.ResumoAsync($"origin/{configuracao.Branch}");
            }, ct);

            var alvo = await ExecutarPassoAsync(release, "conferir o commit alvo", async () =>
            {
                var expandido = await repositorio.ExpandirShaAsync(release.CommitAlvo)
                    ?? throw new ErroDeAtualizacao(
                        $"o commit {release.CommitAlvo} não existe neste repositório");

                if (!await repositorio.CommitPertenceAoBranchAsync(expandido, configuracao.Branch))
                {
                    throw new ErroDeAtualizacao(
                        $"o commit {expandido[..8]} não está na branch {configuracao.Branch}. " +
                        "Ou houve force-push, ou a release aponta para código que ninguém revisou.");
                }

                return expandido;
            }, ct);

            var atual = await repositorio.CommitAtualAsync();
            release.CommitAnterior = atual;

            var mesmoCommit = string.Equals(atual, alvo, StringComparison.OrdinalIgnoreCase);

            if (mesmoCommit && !release.Forcar)
            {
                throw new ErroDeAtualizacao(
                    $"o commit {alvo[..8]} já é o que está no ar. Marque \"recompilar " +
                    "mesmo sem commit novo\" se a intenção era refazer o build.");
            }

            // --------------------------------------------- o que precisa mexer

            var alterados = mesmoCommit
                ? Array.Empty<string>()
                : (await repositorio.ArquivosAlteradosAsync(atual, alvo)).ToArray();

            var afetados = configuracao.Servicos
                .Where(s => release.Forcar ||
                            alterados.Any(a => a.StartsWith(s.Prefixo, StringComparison.OrdinalIgnoreCase)))
                .ToList();

            if (afetados.Count == 0)
            {
                throw new ErroDeAtualizacao(
                    "os commits não tocam em nenhum serviço conhecido. Se a mudança é " +
                    "só de documentação, não há o que aplicar.");
            }

            var precisaDeDependencias = configuracao.Servicos
                .Where(s => alterados.Any(a =>
                    a.Equals($"{s.Prefixo}package.json", StringComparison.OrdinalIgnoreCase) ||
                    a.Equals($"{s.Prefixo}package-lock.json", StringComparison.OrdinalIgnoreCase)))
                .Select(s => s.Id)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            diario.Nota($"vai mexer em: {string.Join(", ", afetados.Select(s => s.Rotulo))}");

            // -------------------------------------------------- avisar primeiro

            await publicador.PublicarAsync(AvisosDeAtualizacao.Iniciou(release), ct);

            // ------------------------------------------------------- a reserva

            await ExecutarPassoAsync(release, "guardar a versão atual", async () =>
            {
                reserva.Guardar(atual, configuracao.Servicos);
                await Task.CompletedTask;
                return $"build atual guardado, volta para {atual[..8]} se precisar";
            }, ct);

            // ----------------------------------------------------- trocar código

            await ExecutarPassoAsync(release, "atualizar o código", async () =>
            {
                await repositorio.SincronizarComAsync(configuracao.Branch, alvo);
                return $"agora em {alvo[..8]}";
            }, ct);

            // -------------------------------------------------- dependências

            foreach (var servico in afetados.Where(s => precisaDeDependencias.Contains(s.Id)))
            {
                if (string.IsNullOrWhiteSpace(servico.ComandoDeDependencias)) continue;

                await ExecutarPassoAsync(release, $"instalar dependências ({servico.Rotulo})",
                    () => RodarAsync(servico.ComandoDeDependencias, PastaDo(servico), TimeSpan.FromMinutes(20), ct),
                    ct);
            }

            // ------------------------------------------------------- compilar
            //
            // Antes de qualquer serviço parar. É o passo que garante que um erro
            // de compilação nunca vire indisponibilidade.

            foreach (var servico in afetados.Where(s => !string.IsNullOrWhiteSpace(s.ComandoDeBuild)))
            {
                await ExecutarPassoAsync(release, $"compilar ({servico.Rotulo})",
                    () => RodarAsync(servico.ComandoDeBuild, PastaDo(servico), TimeSpan.FromMinutes(25), ct),
                    ct);
            }

            // O `vite build` apaga a pasta inteira, e leva junto o aviso que os
            // usuários estão vendo neste exato momento. Republicar aqui.
            await publicador.RepublicarFeedAsync(ct);

            // ------------------------------------------------------ migrations

            foreach (var servico in afetados.Where(s => !string.IsNullOrWhiteSpace(s.ComandoDeMigration)))
            {
                await ExecutarPassoAsync(release, $"aplicar migrations ({servico.Rotulo})",
                    () => RodarAsync(servico.ComandoDeMigration!, PastaDo(servico), TimeSpan.FromMinutes(10), ct),
                    ct);
            }

            // -------------------------------------------------------- reiniciar

            foreach (var servico in afetados)
            {
                await ExecutarPassoAsync(release, $"reiniciar {servico.Rotulo}", async () =>
                {
                    await controleDeServico.ReiniciarAsync(servico.Servico, ct);
                    return "no ar";
                }, ct);
            }

            // ---------------------------------------------------------- saúde

            await ExecutarPassoAsync(release, "conferir se responderam", async () =>
            {
                var mudos = new List<string>();

                foreach (var servico in afetados.Where(s => s.Porta > 0))
                {
                    if (!await sonda.EsperarPortaAsync(servico.Porta, ct: ct))
                        mudos.Add($"{servico.Rotulo} (porta {servico.Porta})");
                }

                if (mudos.Count > 0)
                {
                    throw new ErroDeAtualizacao(
                        $"subiu mas não respondeu: {string.Join(", ", mudos)}");
                }

                return string.Join(", ", afetados.Where(s => s.Porta > 0)
                    .Select(s => $"{s.Rotulo} respondendo na {s.Porta}"));
            }, ct);

            // ------------------------------------------------------- concluído

            reserva.Descartar();

            release.Estado = EstadoDaRelease.Concluida;
            release.ConcluidaEm = DateTimeOffset.Now;
            await deposito.SalvarReleaseAsync(release, ct);

            diario.Ok($"versão {release.Versao} no ar ({alvo[..8]})");

            await deposito.RemoverAvisosDaReleaseAsync(release.Id, ct);
            await publicador.PublicarAsync(
                AvisosDeAtualizacao.Concluiu(
                    release, configuracao.DuracaoDoAvisoDeConclusaoMinutos),
                ct);

            return release;
        }
        catch (Exception erro)
        {
            await DesfazerAsync(release, reserva, erro, ct);
            return release;
        }
    }

    // ----------------------------------------------------------- volta atrás

    /// <summary>
    /// Desfaz o que deu para desfazer e conta a verdade sobre o resto.
    ///
    /// Dois desfechos possíveis, e a diferença entre eles é o que decide se
    /// alguém precisa acordar: `Revertida` significa que a versão anterior está
    /// de pé e respondendo. `Falhou` significa que nem isso — e aí o aviso na
    /// tela do usuário deixa de ter prazo para sumir.
    /// </summary>
    private async Task DesfazerAsync(
        Release release, Reserva reserva, Exception erro, CancellationToken ct)
    {
        var primeiraLinha = erro.Message.Split('\n')[0].Trim();

        release.Falha = primeiraLinha;
        diario.Erro($"falhou: {primeiraLinha}");

        if (!reserva.Existe)
        {
            // Falhou antes de tocar em qualquer coisa: não há o que desfazer, e
            // a produção nunca chegou a ser mexida.
            release.Estado = EstadoDaRelease.Falhou;
            await deposito.SalvarReleaseAsync(release, ct);
            await deposito.RemoverAvisosDaReleaseAsync(release.Id, ct);
            await publicador.RepublicarFeedAsync(ct);

            diario.Nota("nada foi alterado em produção");
            return;
        }

        try
        {
            var configuracao = deposito.Configuracao;

            await ExecutarPassoAsync(release, "voltar para a versão anterior", async () =>
            {
                var commitAnterior = reserva.Restaurar(configuracao.Servicos);
                await repositorio.ResetarParaAsync(commitAnterior);
                return $"código e build de volta em {commitAnterior[..8]}";
            }, ct);

            foreach (var servico in configuracao.Servicos)
            {
                await ExecutarPassoAsync(release, $"reiniciar {servico.Rotulo}", async () =>
                {
                    await controleDeServico.ReiniciarAsync(servico.Servico, ct);
                    return "no ar";
                }, ct);
            }

            var todosDePe = true;
            foreach (var servico in configuracao.Servicos.Where(s => s.Porta > 0))
            {
                if (!await sonda.EsperarPortaAsync(servico.Porta, ct: ct)) todosDePe = false;
            }

            release.Estado = todosDePe ? EstadoDaRelease.Revertida : EstadoDaRelease.Falhou;
            release.ConcluidaEm = DateTimeOffset.Now;
            await deposito.SalvarReleaseAsync(release, ct);

            await deposito.RemoverAvisosDaReleaseAsync(release.Id, ct);

            if (todosDePe)
            {
                diario.Ok("versão anterior restaurada e respondendo");
                reserva.Descartar();

                await publicador.PublicarAsync(
                    AvisosDeAtualizacao.Revertida(release, deposito.VersaoNoAr), ct);
            }
            else
            {
                diario.Atencao(
                    "versão anterior restaurada, mas algum serviço não respondeu — " +
                    $"precisa de olho humano. Reserva preservada em {reserva.Pasta}");

                await publicador.PublicarAsync(AvisosDeAtualizacao.PrecisaDeGente(release), ct);
            }
        }
        catch (Exception erroDaVolta)
        {
            release.Estado = EstadoDaRelease.Falhou;
            release.Falha = $"{primeiraLinha} — e a volta atrás também falhou: {erroDaVolta.Message}";
            release.ConcluidaEm = DateTimeOffset.Now;
            await deposito.SalvarReleaseAsync(release, ct);

            diario.Erro($"a volta atrás também falhou: {erroDaVolta.Message}");
            diario.Atencao($"reserva preservada em {reserva.Pasta}");

            await deposito.RemoverAvisosDaReleaseAsync(release.Id, ct);
            await publicador.PublicarAsync(AvisosDeAtualizacao.PrecisaDeGente(release), ct);
        }
    }

    // -------------------------------------------------------------- apoio

    private string PastaDo(ServicoGerenciado servico)
    {
        var pasta = servico.Prefixo.TrimEnd('/', '\\').Replace('/', Path.DirectorySeparatorChar);
        return Path.Combine(deposito.Configuracao.Raiz, pasta);
    }

    private async Task<string> RodarAsync(
        string comando, string pasta, TimeSpan limite, CancellationToken ct)
    {
        var resultado = await ProcessoExterno.RodarNoShellAsync(comando, pasta, limite, ct);

        if (!resultado.Sucesso)
            throw new ErroDeAtualizacao($"`{comando}` falhou: {resultado.PrimeiraLinhaDeErro()}");

        return $"{resultado.Duracao.TotalSeconds:0}s";
    }

    /// <summary>
    /// Roda um passo, cronometra, registra e persiste — mesmo quando falha.
    ///
    /// Persistir a cada passo custa uma gravação de JSON pequeno e paga o preço
    /// no único momento que importa: quando a máquina reinicia no meio, e a
    /// única coisa que resta para entender o que houve é o arquivo em disco.
    /// </summary>
    private async Task<T> ExecutarPassoAsync<T>(
        Release release, string nome, Func<Task<T>> corpo, CancellationToken ct)
    {
        var passo = new PassoExecutado { Nome = nome, IniciadoEm = DateTimeOffset.Now };
        release.Passos.Add(passo);

        diario.Passo(nome);

        try
        {
            var resultado = await corpo();

            passo.Sucesso = true;
            passo.TerminadoEm = DateTimeOffset.Now;
            passo.Detalhe = resultado?.ToString() ?? "";

            diario.Ok($"{nome}: {passo.Detalhe} ({passo.SegundosGastos}s)");

            await deposito.SalvarReleaseAsync(release, ct);
            return resultado;
        }
        catch (Exception erro)
        {
            passo.Sucesso = false;
            passo.TerminadoEm = DateTimeOffset.Now;
            passo.Detalhe = erro.Message.Split('\n')[0].Trim();

            await deposito.SalvarReleaseAsync(release, CancellationToken.None);
            throw;
        }
    }
}
