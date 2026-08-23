using Upu.Core.Modelos;

namespace Upu.Core.Notificacoes;

/// <summary>
/// Transforma uma release nos avisos que o usuário vê ao longo dela.
///
/// São quatro momentos, e cada um responde a uma coisa que a pessoa do outro
/// lado precisa decidir:
///
///   antes    → "dá tempo de terminar este orçamento?"
///   durante  → "travou, ou é a manutenção?"
///   depois   → "o que mudou na tela que eu uso?"
///   revertido→ "posso voltar a trabalhar normalmente?"
///
/// O texto sai do que o operador preencheu no UPU. É por isso que o resumo é
/// campo obrigatório e tem tamanho mínimo: ele não é documentação, é o que vai
/// estar escrito na tela de todo mundo.
/// </summary>
public static class AvisosDeAtualizacao
{
    /// <summary>O aviso prévio, publicado antes da janela.</summary>
    public static Aviso Previo(Release release, DateTimeOffset janela)
    {
        var interrompe = release.Impacto == ImpactoNoUso.Interrupcao;

        var mensagem = interrompe
            ? $"O sistema vai ficar indisponível por cerca de " +
              $"{release.DuracaoEstimadaMinutos} minuto(s) a partir das " +
              $"{janela:HH\\:mm}. Salve o que estiver fazendo."
            : $"Uma atualização será aplicada às {janela:HH\\:mm}. " +
              (release.Impacto == ImpactoNoUso.Leve
                  ? "A tela pode piscar por alguns segundos."
                  : "Você não deve perceber nada.");

        return new Aviso
        {
            Tipo = interrompe ? TipoDeAviso.Manutencao : TipoDeAviso.Atualizacao,
            Severidade = interrompe ? SeveridadeDoAviso.Atencao : SeveridadeDoAviso.Informacao,
            Titulo = interrompe ? "Manutenção programada" : "Atualização programada",
            Mensagem = mensagem,
            Versao = release.Versao,
            AconteceEm = janela,
            // Um aviso de que o sistema vai cair não deveria ser fechável: quem
            // fechou às 14h não vai lembrar às 15h que era para salvar.
            Dispensavel = !interrompe,
            NotificarNavegador = true,
            ExpiraEm = janela.AddMinutes(5),
            ReleaseId = release.Id
        };
    }

    /// <summary>Publicado no instante em que o pipeline começa.</summary>
    public static Aviso Iniciou(Release release)
    {
        var interrompe = release.Impacto == ImpactoNoUso.Interrupcao;
        var minutos = release.DuracaoEstimadaMinutos ?? 10;

        return new Aviso
        {
            Tipo = interrompe ? TipoDeAviso.Manutencao : TipoDeAviso.Atualizacao,
            Severidade = interrompe ? SeveridadeDoAviso.Critico : SeveridadeDoAviso.Informacao,
            Titulo = interrompe ? "Manutenção em andamento" : "Atualizando o sistema",
            Mensagem = interrompe
                ? $"Estamos aplicando a versão {release.Versao}. A previsão é de " +
                  $"{minutos} minuto(s). Esta tela volta sozinha quando terminar."
                : $"Estamos aplicando a versão {release.Versao}. Pode continuar usando; " +
                  "se a tela piscar, é isto.",
            Versao = release.Versao,
            AconteceEm = DateTimeOffset.Now,
            Dispensavel = false,
            NotificarNavegador = interrompe,
            // Prazo generoso: se o UPU morrer no meio do deploy, o aviso some
            // sozinho em vez de ficar assustando gente para sempre.
            ExpiraEm = DateTimeOffset.Now.AddMinutes(minutos + 30),
            ReleaseId = release.Id
        };
    }

    /// <summary>O que o usuário lê depois: a versão nova e o que ela mudou.</summary>
    public static Aviso Concluiu(Release release, int minutosNaTela)
    {
        return new Aviso
        {
            Tipo = TipoDeAviso.Atualizacao,
            Severidade = SeveridadeDoAviso.Sucesso,
            Titulo = $"Versão {release.Versao} no ar — {release.Titulo}",
            Mensagem = release.ResumoParaUsuarios,
            Versao = release.Versao,
            Detalhes = release.Alteracoes.ToList(),
            Dispensavel = true,
            NotificarNavegador = true,
            ExpiraEm = DateTimeOffset.Now.AddMinutes(minutosNaTela),
            ReleaseId = release.Id
        };
    }

    /// <summary>
    /// Quando deu errado e a versão anterior voltou.
    ///
    /// O usuário não precisa saber o que quebrou — precisa saber que pode voltar
    /// a trabalhar. O detalhe técnico vai para o diário e para o webhook.
    /// </summary>
    public static Aviso Revertida(Release release, string? versaoQueVoltou)
    {
        return new Aviso
        {
            Tipo = TipoDeAviso.Manutencao,
            Severidade = SeveridadeDoAviso.Atencao,
            Titulo = "Manutenção encerrada",
            Mensagem =
                "A atualização não foi concluída e o sistema voltou para a versão " +
                $"anterior{(versaoQueVoltou is null ? "" : $" ({versaoQueVoltou})")}. " +
                "Pode continuar trabalhando normalmente.",
            Versao = versaoQueVoltou,
            Dispensavel = true,
            NotificarNavegador = true,
            ExpiraEm = DateTimeOffset.Now.AddMinutes(60),
            ReleaseId = release.Id
        };
    }

    /// <summary>
    /// Quando nem a volta atrás funcionou. Este aviso fica até alguém tirar.
    /// </summary>
    public static Aviso PrecisaDeGente(Release release)
    {
        return new Aviso
        {
            Tipo = TipoDeAviso.Manutencao,
            Severidade = SeveridadeDoAviso.Critico,
            Titulo = "Sistema em manutenção",
            Mensagem =
                "Estamos trabalhando para restabelecer o sistema. " +
                "Se algo não funcionar, avise o suporte.",
            Versao = release.Versao,
            Dispensavel = false,
            NotificarNavegador = true,
            ExpiraEm = null,
            ReleaseId = release.Id
        };
    }
}
