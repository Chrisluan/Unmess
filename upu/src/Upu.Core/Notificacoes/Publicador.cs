using Upu.Core.Armazenamento;
using Upu.Core.Modelos;
using Upu.Core.Notificacoes.WebPush;
using Upu.Core.Registro;

namespace Upu.Core.Notificacoes;

/// <summary>
/// Um lugar só para publicar aviso, seja qual for o caminho até o usuário.
///
/// Os três canais têm pesos diferentes de propósito. A faixa na tela é o canal
/// que precisa funcionar: é arquivo em disco, na mesma origem que o usuário já
/// abriu, e sobrevive a rede caída e a serviço parado. O push do navegador é o
/// que alcança quem está com a aba fechada, e falha em silêncio quando o
/// usuário nunca permitiu. O webhook é para quem cuida do sistema, não para
/// quem o usa.
///
/// Nenhuma falha de notificação interrompe uma atualização. O contrário —
/// atualizar sem conseguir avisar — é ruim; parar a atualização porque o
/// webhook está fora seria pior.
/// </summary>
public sealed class Publicador(
    Deposito deposito,
    CanalBanner banner,
    CanalWebhook webhook,
    Diario diario)
{
    /// <summary>
    /// Definido pelo servidor depois que as chaves VAPID existem. Nulo mantém a
    /// faixa na tela funcionando e desliga só o push.
    /// </summary>
    public EnvioWebPush? Push { get; set; }

    /// <summary>Publica um aviso novo em todos os canais.</summary>
    public async Task PublicarAsync(Aviso aviso, CancellationToken ct = default)
    {
        await deposito.SalvarAvisoAsync(aviso, ct);
        await RepublicarFeedAsync(ct);

        diario.Nota($"aviso publicado: {aviso.Titulo}");

        await webhook.AvisoAsync(deposito.Configuracao.Webhook, aviso, ct);

        if (aviso.NotificarNavegador) await EmpurrarAsync(aviso, ct);
    }

    /// <summary>
    /// Regrava o `avisos.json` na pasta servida ao usuário.
    ///
    /// Chamado também depois de compilar o frontend, porque o `vite build`
    /// apaga a pasta inteira e levaria o feed junto.
    /// </summary>
    public async Task RepublicarFeedAsync(CancellationToken ct = default)
    {
        var agora = DateTimeOffset.Now;
        await deposito.RemoverAvisosVencidosAsync(agora, ct);

        var configuracao = deposito.Configuracao;

        var feed = new FeedDeAvisos
        {
            GeradoEm = agora,
            VersaoNoAr = deposito.VersaoNoAr,
            ApiPublica = configuracao.CaminhoPublicoDoUpu,
            ChaveVapid = configuracao.VapidPublica,
            Avisos = deposito.Avisos
                .Where(a => a.EstaValido(agora))
                .OrderByDescending(a => a.PublicadoEm)
                .ToList()
        };

        try
        {
            await banner.PublicarAsync(feed, ct);
        }
        catch (Exception erro)
        {
            diario.Atencao(
                $"não consegui gravar o aviso na pasta do frontend: {erro.Message}");
        }
    }

    public async Task RemoverAsync(string avisoId, CancellationToken ct = default)
    {
        await deposito.RemoverAvisoAsync(avisoId, ct);
        await RepublicarFeedAsync(ct);
    }

    /// <summary>
    /// Manda o aviso para os navegadores inscritos e limpa os que sumiram.
    ///
    /// A carga é curta porque o pacote cifrado tem teto de 4 KB nos serviços de
    /// push; o texto inteiro o usuário lê na faixa, ao voltar para a aba.
    /// </summary>
    private async Task EmpurrarAsync(Aviso aviso, CancellationToken ct)
    {
        if (Push is null) return;

        var inscricoes = deposito.Inscricoes.ToList();
        if (inscricoes.Count == 0) return;

        var carga = System.Text.Json.JsonSerializer.Serialize(new
        {
            id = aviso.Id,
            titulo = aviso.Titulo,
            mensagem = Encurtar(aviso.Mensagem, 300),
            tipo = aviso.Tipo.ToString().ToLowerInvariant(),
            severidade = aviso.Severidade.ToString().ToLowerInvariant(),
            versao = aviso.Versao,
            aconteceEm = aviso.AconteceEm,
            link = aviso.Link
        }, Deposito.Json);

        var mortas = new List<string>();
        var aceitos = 0;

        foreach (var inscricao in inscricoes)
        {
            var resultado = await Push.EnviarAsync(inscricao, carga, ct: ct);

            switch (resultado)
            {
                case ResultadoDoEnvio.Aceito:
                    aceitos++;
                    inscricao.UltimoEnvioAceitoEm = DateTimeOffset.Now;
                    inscricao.FalhasSeguidas = 0;
                    await deposito.SalvarInscricaoAsync(inscricao, ct);
                    break;

                case ResultadoDoEnvio.InscricaoMorta:
                    mortas.Add(inscricao.Endpoint);
                    break;

                default:
                    inscricao.FalhasSeguidas++;

                    // Dez falhas seguidas não é rede instável, é inscrição que
                    // não existe mais e o serviço de push não teve a gentileza
                    // de dizer 410.
                    if (inscricao.FalhasSeguidas >= 10) mortas.Add(inscricao.Endpoint);
                    else await deposito.SalvarInscricaoAsync(inscricao, ct);
                    break;
            }
        }

        if (mortas.Count > 0) await deposito.RemoverInscricoesAsync(mortas, ct);

        diario.Nota(
            $"notificação do navegador: {aceitos} de {inscricoes.Count} entregues" +
            (mortas.Count > 0 ? $", {mortas.Count} inscrição(ões) removida(s)" : ""));
    }

    private static string Encurtar(string texto, int limite) =>
        texto.Length <= limite ? texto : texto[..(limite - 1)] + "…";
}
