using Upu.Core.Armazenamento;
using Upu.Core.Deploy;
using Upu.Core.Git;
using Upu.Core.Modelos;
using Upu.Core.Notificacoes;
using Upu.Core.Registro;

namespace Upu.Server.Trabalhadores;

/// <summary>
/// O relógio do UPU: é ele que faz a atualização acontecer sozinha no horário
/// marcado, e que percebe quando há código novo em produção esperando alguém.
///
/// Bate a cada trinta segundos porque a única coisa que ele precisa acertar é a
/// janela agendada — errar por meio minuto às três da manhã não muda nada, e um
/// laço mais apertado gastaria CPU de uma máquina que está atendendo cliente.
///
/// A vigia da branch, que é mais cara (fala com o GitHub), tem o seu próprio
/// intervalo, configurável, e não aplica nada: ela só cria um rascunho e avisa.
/// Publicar na branch nunca deveria ser suficiente para mudar a produção — é
/// para isso que os campos obrigatórios existem.
/// </summary>
public sealed class Agendador(
    Deposito deposito,
    Executor executor,
    Repositorio repositorio,
    Publicador publicador,
    Diario diario,
    ILogger<Agendador> log) : BackgroundService
{
    private static readonly TimeSpan Batida = TimeSpan.FromSeconds(30);

    private DateTimeOffset _ultimaVigia = DateTimeOffset.MinValue;

    /// <summary>Próxima release a entrar. O painel mostra no cabeçalho.</summary>
    public Release? ProximaAgendada =>
        deposito.Releases
            .Where(r => r.Estado is EstadoDaRelease.Agendada or EstadoDaRelease.Avisando)
            .Where(r => r.Janela is not null)
            .OrderBy(r => r.Janela)
            .FirstOrDefault();

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await AoSubirAsync(ct);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await CuidarDasAgendadasAsync(ct);
                await VigiarBranchAsync(ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception erro)
            {
                // O agendador não pode morrer: ele é o que faz a atualização
                // acontecer sem ninguém. Registra e continua na próxima batida.
                log.LogError(erro, "falha na batida do agendador");
                diario.Atencao($"o agendador tropeçou: {erro.Message}");
            }

            try { await Task.Delay(Batida, ct); }
            catch (OperationCanceledException) { break; }
        }
    }

    /// <summary>
    /// Arruma a casa depois de um reinício.
    ///
    /// O caso que importa: uma release ficou marcada como "aplicando" porque a
    /// máquina caiu no meio do deploy. Ela não pode continuar sozinha — metade
    /// do pipeline já rodou e ninguém sabe qual metade —, então é marcada como
    /// falha para que alguém olhe.
    /// </summary>
    private async Task AoSubirAsync(CancellationToken ct)
    {
        foreach (var release in deposito.Releases.Where(r => r.Estado == EstadoDaRelease.Aplicando))
        {
            release.Estado = EstadoDaRelease.Falhou;
            release.Falha =
                "o UPU reiniciou no meio da aplicação. O estado da produção não é " +
                "conhecido; confira os serviços antes de tentar de novo.";
            release.ConcluidaEm = DateTimeOffset.Now;

            await deposito.SalvarReleaseAsync(release, ct);
            diario.Atencao($"release {release.Versao} estava aplicando quando o UPU parou");
        }

        // Os avisos vivem num arquivo dentro da pasta do frontend, que pode ter
        // sido apagada por um build enquanto o UPU estava fora.
        await publicador.RepublicarFeedAsync(ct);
    }

    private async Task CuidarDasAgendadasAsync(CancellationToken ct)
    {
        var agora = DateTimeOffset.Now;

        foreach (var release in deposito.Releases.ToList())
        {
            if (release.Janela is not DateTimeOffset janela) continue;

            switch (release.Estado)
            {
                case EstadoDaRelease.Agendada
                    when janela.AddMinutes(-release.AvisoPrevioMinutos) <= agora:

                    // Sem aviso prévio configurado, não há fase de aviso: se a
                    // hora chegou, aplica.
                    if (release.AvisoPrevioMinutos <= 0 && janela <= agora)
                    {
                        await AplicarAsync(release, ct);
                        break;
                    }

                    release.Estado = EstadoDaRelease.Avisando;
                    release.AvisadaEm = agora;
                    await deposito.SalvarReleaseAsync(release, ct);

                    diario.Nota(
                        $"avisando os usuários: versão {release.Versao} às {janela:HH\\:mm}");

                    await publicador.PublicarAsync(
                        AvisosDeAtualizacao.Previo(release, janela), ct);
                    break;

                case EstadoDaRelease.Avisando when janela <= agora:
                    await AplicarAsync(release, ct);
                    break;
            }
        }
    }

    private async Task AplicarAsync(Release release, CancellationToken ct)
    {
        diario.Passo($"chegou a hora marcada da versão {release.Versao}");

        try
        {
            await executor.AplicarAsync(release, ct);
        }
        catch (Exception erro)
        {
            // O executor já desfez e registrou o que deu para desfazer; o que
            // sobra aqui é o caso de ele nem ter conseguido começar.
            diario.Erro($"não consegui aplicar a versão {release.Versao}: {erro.Message}");

            if (release.Estado is EstadoDaRelease.Agendada or EstadoDaRelease.Avisando
                or EstadoDaRelease.Aplicando)
            {
                release.Estado = EstadoDaRelease.Falhou;
                release.Falha = erro.Message.Split('\n')[0].Trim();
                await deposito.SalvarReleaseAsync(release, ct);
            }
        }
    }

    /// <summary>
    /// Olha a branch de produção e, se houver commit novo sem release, cria um
    /// rascunho para lembrar que falta preencher os campos.
    ///
    /// O rascunho não aplica nada, nunca. Ele existe para que "publiquei na
    /// branch e nada aconteceu" seja uma pergunta com resposta visível no
    /// painel, em vez de silêncio.
    /// </summary>
    private async Task VigiarBranchAsync(CancellationToken ct)
    {
        var configuracao = deposito.Configuracao;

        if (!configuracao.VigiarBranch) return;

        var intervalo = TimeSpan.FromMinutes(Math.Max(1, configuracao.IntervaloDeVigiaMinutos));
        if (DateTimeOffset.Now - _ultimaVigia < intervalo) return;

        _ultimaVigia = DateTimeOffset.Now;

        try
        {
            await repositorio.BuscarAsync(configuracao.Branch);

            var atual = await repositorio.CommitAtualAsync();
            var remoto = await repositorio.CommitRemotoAsync(configuracao.Branch);

            if (string.Equals(atual, remoto, StringComparison.OrdinalIgnoreCase)) return;

            // Já existe uma release cuidando deste commit? Então não há novidade.
            var jaCuidada = deposito.Releases.Any(r =>
                r.CommitAlvo.StartsWith(remoto[..8], StringComparison.OrdinalIgnoreCase) &&
                r.Estado is EstadoDaRelease.Rascunho or EstadoDaRelease.Agendada
                    or EstadoDaRelease.Avisando or EstadoDaRelease.Aplicando
                    or EstadoDaRelease.Concluida);

            if (jaCuidada) return;

            var commits = await repositorio.CommitsEntreAsync(atual, remoto);

            var rascunho = new Release
            {
                Titulo = commits.Count == 1
                    ? commits[0].Assunto
                    : $"{commits.Count} commits novos em {configuracao.Branch}",
                CommitAlvo = remoto,
                Estado = EstadoDaRelease.Rascunho,
                CriadaPor = "UPU (vigia da branch)",
                Alteracoes = commits.Select(c => c.Assunto).Take(20).ToList(),
                AvisoPrevioMinutos = configuracao.AvisoPrevioPadraoMinutos,
                Responsavel = commits.Count > 0 ? commits[0].Autor : ""
            };

            await deposito.SalvarReleaseAsync(rascunho, ct);

            diario.Nota(
                $"há {commits.Count} commit(s) novo(s) em {configuracao.Branch}. " +
                "Criei um rascunho: falta preencher os campos obrigatórios no painel.");
        }
        catch (ErroDeGit erro)
        {
            // Sem rede, ou credencial vencida. Não é motivo de alarme a cada
            // dez minutos, mas precisa aparecer em algum lugar.
            diario.Atencao($"não consegui olhar a branch: {erro.Message}");
        }
    }
}
