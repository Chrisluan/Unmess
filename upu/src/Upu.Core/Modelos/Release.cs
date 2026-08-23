namespace Upu.Core.Modelos;

/// <summary>
/// O que uma atualização atravessa, do preenchimento ao ar.
///
/// Os estados existem para que o agendador saiba, olhando um campo só, o que
/// fazer com cada release a cada volta do relógio — sem reconstruir a história
/// pelas datas.
/// </summary>
public enum EstadoDaRelease
{
    /// Campos ainda incompletos. Nunca é aplicada.
    Rascunho,

    /// Validada e com hora marcada. Esperando o aviso prévio.
    Agendada,

    /// Aviso prévio publicado; os usuários já sabem que vai acontecer.
    Avisando,

    /// Pipeline rodando neste instante.
    Aplicando,

    /// No ar, com a saúde conferida.
    Concluida,

    /// Falhou e a volta atrás também não deu certo. Precisa de gente.
    Falhou,

    /// Falhou, mas a versão anterior voltou sozinha e está de pé.
    Revertida,

    /// Alguém cancelou antes de aplicar.
    Cancelada
}

/// <summary>
/// Natureza da mudança. Aparece para o usuário e decide o rigor da validação:
/// segurança e crítica exigem plano de volta escrito.
/// </summary>
public enum TipoDeRelease
{
    Correcao,
    Melhoria,
    Recurso,
    Seguranca,
    Critica
}

/// <summary>
/// O que o usuário sente. É o campo que define se o aviso prévio é opcional ou
/// obrigatório — ninguém deve descobrir que o sistema caiu ao clicar em salvar.
/// </summary>
public enum ImpactoNoUso
{
    /// Troca invisível: nada reinicia, ou reinicia tão rápido que não se nota.
    Nenhum,

    /// Segundos de instabilidade. A tela pode piscar ou pedir recarregar.
    Leve,

    /// O atendimento para pelo tempo estimado.
    Interrupcao
}

/// <summary>
/// Um passo do pipeline, com o que aconteceu. É isto que o painel mostra ao
/// vivo enquanto a atualização roda, e o que sobra para investigar depois.
/// </summary>
public sealed class PassoExecutado
{
    public string Nome { get; set; } = "";
    public DateTimeOffset IniciadoEm { get; set; }
    public DateTimeOffset? TerminadoEm { get; set; }
    public bool Sucesso { get; set; }

    /// Saída relevante, já cortada: log inteiro de build não cabe no painel.
    public string Detalhe { get; set; } = "";

    public double SegundosGastos =>
        TerminadoEm is null ? 0 : Math.Round((TerminadoEm.Value - IniciadoEm).TotalSeconds, 1);
}

/// <summary>
/// A atualização, do jeito que o operador a descreve no UPU.
///
/// Nada aqui é decorativo: cada campo obrigatório existe porque a sua ausência
/// já custou alguma coisa em produção — um usuário surpreendido por uma queda,
/// um deploy que ninguém sabia de quem era, uma versão que não dava para citar
/// ao relatar um defeito.
/// </summary>
public sealed class Release
{
    public string Id { get; set; } = Guid.NewGuid().ToString("n");

    // ---------------------------------------------------------- obrigatórios

    /// <summary>Semver `x.y.z`. Precisa ser maior que a última no ar.</summary>
    public string Versao { get; set; } = "";

    /// <summary>Nome curto da entrega, para listas e histórico.</summary>
    public string Titulo { get; set; } = "";

    public TipoDeRelease? Tipo { get; set; }

    /// <summary>
    /// O texto que o usuário lê no banner. Escrito para quem atende cliente,
    /// não para quem programa.
    /// </summary>
    public string ResumoParaUsuarios { get; set; } = "";

    /// <summary>Lista do que mudou, uma linha por mudança.</summary>
    public List<string> Alteracoes { get; set; } = new();

    public ImpactoNoUso? Impacto { get; set; }

    /// <summary>Obrigatório quando o impacto é interrupção.</summary>
    public int? DuracaoEstimadaMinutos { get; set; }

    /// <summary>Quem assume esta atualização.</summary>
    public string Responsavel { get; set; } = "";

    /// <summary>Commit da branch de produção que esta release congela.</summary>
    public string CommitAlvo { get; set; } = "";

    /// <summary>
    /// Como voltar se der errado. O UPU reverte sozinho, mas há coisas que ele
    /// não desfaz — migration destrutiva, arquivo de cliente — e é isso que se
    /// escreve aqui.
    /// </summary>
    public string PlanoDeVolta { get; set; } = "";

    /// <summary>Confirmação explícita de que rodou em desenvolvimento.</summary>
    public bool TestadoEmDesenvolvimento { get; set; }

    /// <summary>
    /// Recompila e reinicia mesmo que o commit alvo já seja o que está no ar.
    ///
    /// Serve para quando o código está certo e o que quebrou foi o build —
    /// pasta apagada, dependência corrompida, disco cheio no meio.
    /// </summary>
    public bool Forcar { get; set; }

    // ------------------------------------------------------------- agenda

    /// <summary>Quando aplicar. Nulo significa "assim que eu mandar".</summary>
    public DateTimeOffset? Janela { get; set; }

    /// <summary>Quanto tempo antes da janela os usuários são avisados.</summary>
    public int AvisoPrevioMinutos { get; set; } = 30;

    // ------------------------------------------------------------- estado

    public EstadoDaRelease Estado { get; set; } = EstadoDaRelease.Rascunho;

    public DateTimeOffset CriadaEm { get; set; } = DateTimeOffset.Now;
    public DateTimeOffset AtualizadaEm { get; set; } = DateTimeOffset.Now;
    public DateTimeOffset? AvisadaEm { get; set; }
    public DateTimeOffset? IniciadaEm { get; set; }
    public DateTimeOffset? ConcluidaEm { get; set; }

    /// <summary>Commit que estava no ar antes. É para onde a volta atrás leva.</summary>
    public string? CommitAnterior { get; set; }

    public List<PassoExecutado> Passos { get; set; } = new();

    /// <summary>Primeira linha do erro, quando houve.</summary>
    public string? Falha { get; set; }

    /// <summary>Quem preencheu — o painel é de senha única, então é o nome digitado.</summary>
    public string CriadaPor { get; set; } = "";

    public bool PodeSerEditada =>
        Estado is EstadoDaRelease.Rascunho or EstadoDaRelease.Agendada;

    public bool EstaEmAndamento =>
        Estado is EstadoDaRelease.Aplicando or EstadoDaRelease.Avisando;
}
