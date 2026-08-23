namespace Upu.Core.Modelos;

/// <summary>Um serviço do Windows que o UPU reinicia e confere.</summary>
public sealed class ServicoGerenciado
{
    /// <summary>Chave curta usada pelo painel e pelo pipeline (`backend`).</summary>
    public string Id { get; set; } = "";

    /// <summary>Nome real no Gerenciador de Serviços (`unmess-backend`).</summary>
    public string Servico { get; set; } = "";

    public string Rotulo { get; set; } = "";

    /// <summary>Porta que prova que a aplicação subiu, não só o serviço.</summary>
    public int Porta { get; set; }

    /// <summary>Pasta, relativa à raiz, cujas mudanças exigem recompilar.</summary>
    public string Prefixo { get; set; } = "";

    /// <summary>Comando de compilação, rodado na pasta do serviço.</summary>
    public string ComandoDeBuild { get; set; } = "";

    /// <summary>
    /// Instalação de dependências, rodada só quando o `package.json` daquele
    /// lado mudou.
    ///
    /// É `npm install` e não `npm ci` de propósito: o `package-lock.json` está
    /// no .gitignore desta instalação, e o `ci` exige o lock — falharia em todo
    /// deploy que mexesse em dependência.
    /// </summary>
    public string ComandoDeDependencias { get; set; } = "";

    /// <summary>Comando de migration, quando houver banco atrás.</summary>
    public string? ComandoDeMigration { get; set; }

    /// <summary>Pasta de saída do build, guardada na reserva para voltar atrás.</summary>
    public string PastaDeSaida { get; set; } = "";
}

/// <summary>
/// Tudo que o UPU precisa saber sobre esta instalação.
///
/// Fica em `upu/dados/configuracao.json`, fora do git: os nomes de serviço, as
/// portas e as chaves são desta máquina, não do projeto. O painel edita tudo
/// que é editável sem reiniciar o serviço.
/// </summary>
public sealed class Configuracao
{
    /// <summary>Raiz do repositório que o UPU atualiza.</summary>
    public string Raiz { get; set; } = @"C:\unmess";

    public string Branch { get; set; } = "production";

    /// <summary>
    /// Endereço em que o painel do UPU escuta.
    ///
    /// 8091 porque a 8090 é do painel de operação desta instalação. Só em
    /// 127.0.0.1: o UPU reinicia serviços e troca o código da produção, e quem
    /// precisa alcançá-lo de fora passa pelo encaminhamento das rotas públicas.
    /// </summary>
    public string EnderecoDeEscuta { get; set; } = "http://127.0.0.1:8091";

    public List<ServicoGerenciado> Servicos { get; set; } = new()
    {
        new ServicoGerenciado
        {
            Id = "backend",
            Servico = "unmess-backend",
            Rotulo = "API (backend)",
            Porta = 8080,
            Prefixo = "backend/",
            ComandoDeBuild = "npm run build",
            ComandoDeDependencias = "npm install --omit=dev --no-audit --no-fund",
            ComandoDeMigration = "npx sequelize db:migrate",
            PastaDeSaida = @"backend\dist"
        },
        new ServicoGerenciado
        {
            Id = "frontend",
            Servico = "unmess-frontend",
            Rotulo = "Interface (frontend)",
            Porta = 3333,
            Prefixo = "frontend/",
            ComandoDeBuild = "npx vite build",
            ComandoDeDependencias = "npm install --no-audit --no-fund",
            ComandoDeMigration = null,
            PastaDeSaida = @"frontend\build"
        }
    };

    /// <summary>
    /// Pasta servida ao navegador do usuário. É onde o UPU grava `avisos.json`
    /// e o widget: assim o aviso chega pela mesma origem que o usuário já usa,
    /// sem porta nova exposta e sem CORS.
    /// </summary>
    public string PastaPublicaDoFrontend { get; set; } = @"frontend\build";

    /// <summary>
    /// Endereço, visto do navegador do usuário, em que o UPU atende as rotas
    /// públicas (inscrição de push e leitura do feed).
    ///
    /// O padrão `/upu` é um caminho relativo: assume que o servidor do frontend
    /// encaminha `/upu/*` para cá. Isso mantém tudo na mesma origem, o que é o
    /// que faz a inscrição de push funcionar quando o sistema é servido por
    /// HTTPS — uma página segura não fala com um endereço http:// sem ser
    /// bloqueada pelo navegador.
    ///
    /// Sem esse encaminhamento nada quebra: a faixa na tela continua vindo do
    /// arquivo, e a notificação do navegador ainda aparece com a aba aberta. O
    /// que se perde é o aviso chegar com a aba fechada.
    /// </summary>
    public string CaminhoPublicoDoUpu { get; set; } = "/upu";

    /// <summary>Horário sugerido ao abrir o formulário. Fora do expediente.</summary>
    public string JanelaPadrao { get; set; } = "03:00";

    public int AvisoPrevioPadraoMinutos { get; set; } = 30;

    /// <summary>
    /// Vigia a branch sozinho e cria um rascunho quando aparece commit novo.
    /// O rascunho não aplica nada: serve para lembrar que há código em produção
    /// esperando alguém preencher os campos.
    /// </summary>
    public bool VigiarBranch { get; set; } = true;

    public int IntervaloDeVigiaMinutos { get; set; } = 10;

    /// <summary>URL que recebe um POST a cada evento. Vazio desliga o canal.</summary>
    public string? Webhook { get; set; }

    /// <summary>Assunto VAPID exigido pelos serviços de push (mailto: ou https:).</summary>
    public string ContatoVapid { get; set; } = "mailto:suporte@unmess.local";

    public string? VapidPublica { get; set; }
    public string? VapidPrivada { get; set; }

    /// <summary>Hash PBKDF2 da senha do painel, e o sal. Nulos = primeira execução.</summary>
    public string? SenhaHash { get; set; }
    public string? SenhaSal { get; set; }
    public DateTimeOffset? SenhaDefinidaEm { get; set; }

    /// <summary>
    /// Minutos que o aviso de "atualizado" fica na tela depois de concluir.
    /// </summary>
    public int DuracaoDoAvisoDeConclusaoMinutos { get; set; } = 120;

    public ServicoGerenciado? ServicoPorId(string id) =>
        Servicos.FirstOrDefault(s => string.Equals(s.Id, id, StringComparison.OrdinalIgnoreCase));
}
