using Upu.Core.Armazenamento;
using Upu.Core.Deploy;
using Upu.Core.Git;
using Upu.Core.Notificacoes;
using Upu.Core.Notificacoes.WebPush;
using Upu.Core.Registro;
using Upu.Server.Api;
using Upu.Server.Seguranca;
using Upu.Server.Trabalhadores;

// ---------------------------------------------------------------------------
// UPU — Unmess Production Updater
//
// Um serviço que fica de pé o tempo todo na máquina que hospeda a produção. Ele
// é quem busca a branch de produção, aplica a atualização no horário marcado e
// avisa os usuários — mas só depois que alguém preencheu, no painel, os campos
// que descrevem a atualização.
//
// A ordem de partida importa: a configuração é lida antes de o servidor web
// existir, porque é ela que diz em que endereço escutar e onde fica a raiz do
// repositório. Se essa leitura falhar, é melhor não subir do que subir vigiando
// a pasta errada.
// ---------------------------------------------------------------------------

var pastaDeDados = Environment.GetEnvironmentVariable("UPU_DADOS")
    ?? Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "dados"));

var deposito = new Deposito(pastaDeDados);
await deposito.CarregarAsync();

var configuracao = deposito.Configuracao;

// Primeira execução: gera o par VAPID e grava o arquivo, para que ele exista em
// disco e possa ser editado à mão. Trocar essas chaves depois invalidaria todas
// as permissões de notificação já concedidas, então elas nascem uma vez só.
if (string.IsNullOrEmpty(configuracao.VapidPublica) ||
    string.IsNullOrEmpty(configuracao.VapidPrivada))
{
    var novas = ChavesVapid.Gerar();
    configuracao.VapidPublica = novas.PublicaBase64Url;
    configuracao.VapidPrivada = novas.PrivadaBase64Url;
}

await deposito.SalvarConfiguracaoAsync();

// A raiz de conteúdo e a do painel entram aqui, na construção, e não por
// `UseContentRoot`/`UseWebRoot` depois — o WebApplicationBuilder recusa mudanças
// dessas duas quando o host já foi configurado.
//
// Fixar em AppContext.BaseDirectory não é redundância: rodando como Serviço do
// Windows, o diretório atual do processo é C:\Windows\System32, e o painel
// seria procurado lá.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory,
    WebRootPath = "publico"
});

// Faz o mesmo executável servir de Serviço do Windows e de aplicação de
// console. Rodando fora de um serviço, esta linha não faz nada.
builder.Host.UseWindowsService(opcoes => opcoes.ServiceName = "unmess-upu");

builder.WebHost.UseUrls(configuracao.EnderecoDeEscuta);

// O log do .NET vai para o Visualizador de Eventos quando roda como serviço; o
// diário do UPU é outra coisa, e é o que se lê depois de uma noite ruim.
builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);

var diario = new Diario(Path.Combine(configuracao.Raiz, "logs", "upu.log"));

builder.Services.AddSingleton(deposito);
builder.Services.AddSingleton(diario);
builder.Services.AddSingleton(new Repositorio(configuracao.Raiz));
builder.Services.AddSingleton<ControleDeServico>();
builder.Services.AddSingleton<SondaDeSaude>();
builder.Services.AddSingleton<Autenticacao>();

builder.Services.AddHttpClient("upu", cliente =>
{
    // Curto de propósito: nenhum canal de notificação vale segurar um deploy.
    cliente.Timeout = TimeSpan.FromSeconds(15);
    cliente.DefaultRequestHeaders.UserAgent.ParseAdd("upu/1.0");
});

builder.Services.AddSingleton(_ => new CanalBanner(
    configuracao.Raiz,
    configuracao.PastaPublicaDoFrontend,
    Path.Combine(AppContext.BaseDirectory, "recursos")));

builder.Services.AddSingleton(sp => new CanalWebhook(
    sp.GetRequiredService<IHttpClientFactory>().CreateClient("upu")));

builder.Services.AddSingleton<Publicador>();
builder.Services.AddSingleton<Executor>();

builder.Services.AddSingleton<Agendador>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<Agendador>());

var app = builder.Build();

// O envio de push depende das chaves, que só existem depois da carga acima.
// Sem elas, a faixa na tela continua funcionando e só o push fica desligado.
if (configuracao.VapidPublica is { Length: > 0 } publica &&
    configuracao.VapidPrivada is { Length: > 0 } privada)
{
    app.Services.GetRequiredService<Publicador>().Push = new EnvioWebPush(
        app.Services.GetRequiredService<IHttpClientFactory>().CreateClient("upu"),
        ChavesVapid.Ler(publica, privada),
        configuracao.ContatoVapid);
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapearRotasPublicas();
app.MapearRotasDoPainel();

diario.Passo($"UPU no ar em {configuracao.EnderecoDeEscuta}");
diario.Nota($"repositório {configuracao.Raiz}, branch {configuracao.Branch}");
diario.Nota($"dados em {pastaDeDados}");

foreach (var arquivo in deposito.ArquivosCorrompidos)
    diario.Atencao($"arquivo posto de lado, recomecei do padrão: {arquivo}");

if (!app.Services.GetRequiredService<Autenticacao>().SenhaDefinida)
    diario.Atencao("nenhuma senha definida ainda: abra o painel para criar a primeira");

app.Run();
