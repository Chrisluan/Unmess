namespace Upu.Core.Modelos;

/// <summary>
/// De onde o aviso veio. O usuário vê o mesmo lugar na tela para tudo, mas a
/// origem decide cor, ícone e se dá para dispensar.
/// </summary>
public enum TipoDeAviso
{
    /// Vai atualizar / atualizou. Publicado pelo próprio UPU.
    Atualizacao,

    /// Vai parar, ou parou, por manutenção.
    Manutencao,

    /// Aviso comercial do unmess para os clientes.
    Promocional,

    /// Recado operacional: mudança de configuração, novo procedimento.
    Configuracao,

    /// Mensagem de conversa que precisa aparecer fora da aba do chat.
    Conversa,

    /// Qualquer outra coisa que o sistema precise dizer.
    Geral
}

/// <summary>Peso visual do aviso na faixa do topo.</summary>
public enum SeveridadeDoAviso
{
    Informacao,
    Sucesso,
    Atencao,
    Critico
}

/// <summary>
/// O que aparece na faixa do topo da tela do usuário e, se ele tiver permitido,
/// como notificação do navegador.
///
/// O UPU é o único produtor de avisos de atualização, mas o formato é geral de
/// propósito: o unmess publica aqui as promoções, os recados de configuração e
/// as mensagens de conversa, e o usuário passa a ter um lugar só onde olhar.
/// </summary>
public sealed class Aviso
{
    public string Id { get; set; } = Guid.NewGuid().ToString("n");

    public TipoDeAviso Tipo { get; set; } = TipoDeAviso.Geral;
    public SeveridadeDoAviso Severidade { get; set; } = SeveridadeDoAviso.Informacao;

    public string Titulo { get; set; } = "";
    public string Mensagem { get; set; } = "";

    /// <summary>Versão a que o aviso se refere, quando é de atualização.</summary>
    public string? Versao { get; set; }

    /// <summary>Lista curta de mudanças, mostrada expandida no banner.</summary>
    public List<string> Detalhes { get; set; } = new();

    /// <summary>Link opcional: notas da versão, tutorial, promoção.</summary>
    public string? Link { get; set; }
    public string? RotuloDoLink { get; set; }

    public DateTimeOffset PublicadoEm { get; set; } = DateTimeOffset.Now;

    /// <summary>Depois disto some da tela sozinho, sem ninguém limpar.</summary>
    public DateTimeOffset? ExpiraEm { get; set; }

    /// <summary>
    /// Se o usuário pode fechar o banner. Um aviso de "vai cair em 5 minutos"
    /// não deveria ser dispensável; um "nova versão no ar" deveria.
    /// </summary>
    public bool Dispensavel { get; set; } = true;

    /// <summary>Manda também como notificação do navegador, não só a faixa.</summary>
    public bool NotificarNavegador { get; set; } = true;

    /// <summary>Quando a atualização vai começar — o widget mostra a contagem.</summary>
    public DateTimeOffset? AconteceEm { get; set; }

    /// <summary>Release que originou o aviso, quando houver.</summary>
    public string? ReleaseId { get; set; }

    public bool EstaValido(DateTimeOffset agora) => ExpiraEm is null || ExpiraEm > agora;
}
