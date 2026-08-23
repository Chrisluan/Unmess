using Upu.Core.Modelos;

namespace Upu.Core.Validacao;

/// <summary>
/// O portão do UPU: sem estes campos preenchidos, nenhuma atualização entra em
/// produção.
///
/// A regra não é burocracia. Cada exigência aqui responde a uma pergunta que
/// alguém vai fazer depois, e que ninguém consegue responder no dia seguinte:
///
///   "que versão está no ar?"               → Versao
///   "o que mudou para o cliente?"           → ResumoParaUsuarios, Alteracoes
///   "vai cair? por quanto tempo?"           → Impacto, DuracaoEstimadaMinutos
///   "quem subiu isso?"                      → Responsavel
///   "e se der errado?"                      → PlanoDeVolta
///   "isso chegou a rodar em algum lugar?"   → TestadoEmDesenvolvimento
///
/// A validação roda em dois momentos, de propósito: quando o painel salva, para
/// ensinar enquanto a pessoa digita; e de novo dentro do executor, um instante
/// antes de tocar no código — porque entre agendar e aplicar pode passar uma
/// noite, e nesse meio-tempo a versão no ar pode ter mudado.
/// </summary>
public static class ValidadorDeRelease
{
    public const int MinimoDoResumo = 20;
    public const int MinimoDoPlanoDeVolta = 20;
    public const int MaximoDoTitulo = 80;
    public const int MaximoDeDuracaoMinutos = 240;

    /// <summary>
    /// Confere a release inteira.
    /// </summary>
    /// <param name="release">O que o operador preencheu.</param>
    /// <param name="versaoNoAr">
    /// Versão da última release concluída, para exigir que a nova seja maior.
    /// Nulo na primeira release desta instalação.
    /// </param>
    /// <param name="agora">Passado explicitamente para o teste ser determinístico.</param>
    public static IReadOnlyList<ErroDeCampo> Validar(
        Release release,
        string? versaoNoAr,
        DateTimeOffset agora)
    {
        var erros = new List<ErroDeCampo>();

        // ------------------------------------------------------------ versão

        if (!Versao.TentarLer(release.Versao, out var versao))
        {
            erros.Add(new ErroDeCampo(
                "versao",
                "Informe a versão no formato 1.4.0. É por este número que o " +
                "usuário vai chamar o que está vendo quando relatar um problema."));
        }
        else if (Versao.TentarLer(versaoNoAr, out var atual) && versao.CompareTo(atual) <= 0)
        {
            erros.Add(new ErroDeCampo(
                "versao",
                $"A versão {versao} não é maior que a {atual}, que já está no ar. " +
                "Versão que anda para trás faz o histórico mentir."));
        }

        // ------------------------------------------------------------ título

        var titulo = release.Titulo?.Trim() ?? "";
        if (titulo.Length < 5)
        {
            erros.Add(new ErroDeCampo(
                "titulo",
                "Dê um nome curto à entrega, com pelo menos 5 caracteres."));
        }
        else if (titulo.Length > MaximoDoTitulo)
        {
            erros.Add(new ErroDeCampo(
                "titulo",
                $"O título passou de {MaximoDoTitulo} caracteres. O detalhe vai " +
                "nas alterações; aqui é só o nome."));
        }

        // -------------------------------------------------------------- tipo

        if (release.Tipo is null)
        {
            erros.Add(new ErroDeCampo(
                "tipo",
                "Escolha o tipo. É ele que decide a cor do aviso e o rigor exigido aqui."));
        }

        // ------------------------------------------------------------ resumo

        var resumo = release.ResumoParaUsuarios?.Trim() ?? "";
        if (resumo.Length < MinimoDoResumo)
        {
            erros.Add(new ErroDeCampo(
                "resumoParaUsuarios",
                $"Escreva ao menos {MinimoDoResumo} caracteres do que muda para quem " +
                "usa o sistema. Este texto vai aparecer na tela de todos os clientes — " +
                "não escreva para programador."));
        }

        // -------------------------------------------------------- alterações

        var alteracoes = (release.Alteracoes ?? new List<string>())
            .Select(a => a?.Trim() ?? "")
            .Where(a => a.Length > 0)
            .ToList();

        if (alteracoes.Count == 0)
        {
            erros.Add(new ErroDeCampo(
                "alteracoes",
                "Liste pelo menos uma alteração. Sem isso não há como conferir " +
                "depois se o que subiu foi o que se pretendia."));
        }
        else if (alteracoes.Any(a => a.Length < 5))
        {
            erros.Add(new ErroDeCampo(
                "alteracoes",
                "Há alteração escrita com menos de 5 caracteres. Descreva o que mudou."));
        }

        // ----------------------------------------------------------- impacto

        if (release.Impacto is null)
        {
            erros.Add(new ErroDeCampo(
                "impacto",
                "Diga o que o usuário sente: nada, uma piscada, ou o sistema parado."));
        }
        else if (release.Impacto == ImpactoNoUso.Interrupcao)
        {
            if (release.DuracaoEstimadaMinutos is not int minutos ||
                minutos < 1 || minutos > MaximoDeDuracaoMinutos)
            {
                erros.Add(new ErroDeCampo(
                    "duracaoEstimadaMinutos",
                    "O sistema vai parar; estime por quantos minutos (1 a " +
                    $"{MaximoDeDuracaoMinutos}). O usuário precisa saber se espera " +
                    "ou se vai almoçar."));
            }
        }

        // ------------------------------------------------------- responsável

        if ((release.Responsavel?.Trim().Length ?? 0) < 3)
        {
            erros.Add(new ErroDeCampo(
                "responsavel",
                "Diga quem assume esta atualização. Às três da manhã, alguém vai " +
                "querer saber para quem ligar."));
        }

        // ------------------------------------------------------- commit alvo

        var commit = release.CommitAlvo?.Trim() ?? "";
        if (commit.Length < 7 || !commit.All(Uri.IsHexDigit))
        {
            erros.Add(new ErroDeCampo(
                "commitAlvo",
                "Escolha o commit da branch de produção que esta versão congela."));
        }

        // ---------------------------------------------------- plano de volta

        var exigePlano =
            release.Tipo is TipoDeRelease.Critica or TipoDeRelease.Seguranca ||
            release.Impacto == ImpactoNoUso.Interrupcao;

        var plano = release.PlanoDeVolta?.Trim() ?? "";
        if (exigePlano && plano.Length < MinimoDoPlanoDeVolta)
        {
            erros.Add(new ErroDeCampo(
                "planoDeVolta",
                "Esta release é crítica, de segurança ou derruba o atendimento: " +
                "escreva como voltar. O UPU restaura código e build sozinho, mas " +
                "não desfaz migration destrutiva nem dado de cliente já gravado."));
        }

        // ----------------------------------------------------------- testado

        if (!release.TestadoEmDesenvolvimento)
        {
            erros.Add(new ErroDeCampo(
                "testadoEmDesenvolvimento",
                "Confirme que rodou em desenvolvimento. Produção não é o primeiro " +
                "lugar onde um código roda."));
        }

        // ------------------------------------------------------------ agenda

        if (release.Janela is DateTimeOffset janela && janela <= agora.AddMinutes(1))
        {
            erros.Add(new ErroDeCampo(
                "janela",
                "O horário agendado já passou. Escolha um horário futuro, ou " +
                "deixe em branco para aplicar na hora."));
        }

        if (release.AvisoPrevioMinutos < 0 || release.AvisoPrevioMinutos > 1440)
        {
            erros.Add(new ErroDeCampo(
                "avisoPrevioMinutos",
                "O aviso prévio vai de 0 a 1440 minutos (24 horas)."));
        }
        else if (release.Impacto is ImpactoNoUso.Interrupcao &&
                 release.AvisoPrevioMinutos < 10)
        {
            erros.Add(new ErroDeCampo(
                "avisoPrevioMinutos",
                "O sistema vai parar: avise com pelo menos 10 minutos. Ninguém " +
                "deve descobrir a manutenção ao clicar em salvar."));
        }

        if (release.Impacto is ImpactoNoUso.Interrupcao && release.Janela is null)
        {
            erros.Add(new ErroDeCampo(
                "janela",
                "Uma atualização que derruba o atendimento precisa de horário " +
                "marcado, para caber no aviso prévio."));
        }

        return erros;
    }

    /// <summary>Atalho para quem só quer saber se passa ou não.</summary>
    public static bool EstaCompleta(Release release, string? versaoNoAr, DateTimeOffset agora) =>
        Validar(release, versaoNoAr, agora).Count == 0;
}
