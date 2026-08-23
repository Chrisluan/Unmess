using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Upu.Core.Modelos;

namespace Upu.Core.Notificacoes.WebPush;

/// <summary>O que o serviço de push respondeu, traduzido para o que fazer.</summary>
public enum ResultadoDoEnvio
{
    /// Entregue ao serviço de push. Ele leva ao navegador quando puder.
    Aceito,

    /// O navegador sumiu: desinstalado, permissão revogada, inscrição vencida.
    /// A inscrição é apagada.
    InscricaoMorta,

    /// Deu errado agora. A inscrição continua valendo e a próxima tenta de novo.
    Falhou
}

/// <summary>
/// Manda notificação para o navegador do usuário, mesmo com a aba fechada.
///
/// Implementa o Web Push como as RFCs 8291 (cifra) e 8292 (VAPID) descrevem, com
/// o que já vem no .NET 8 — ECDH, HKDF e AES-GCM. Não há biblioteca de fora, e
/// isso é deliberado: uma dependência que precisa restaurar durante um deploy é
/// uma forma de o servidor ficar sem conseguir avisar que está caindo.
///
/// O ponto que costuma surpreender: o servidor de push do Google não consegue
/// ler o que está mandando. O conteúdo é cifrado com uma chave derivada da
/// chave pública do próprio navegador; o intermediário só carrega o envelope.
/// Por isso a carga vai inteira no pacote, e não como um "vá buscar em tal URL".
/// </summary>
public sealed class EnvioWebPush(HttpClient http, ChavesVapid chaves, string contato)
{
    /// <summary>
    /// Tamanho do registro. 4096 é o teto que os serviços de push garantem
    /// aceitar; o aviso é cortado antes de chegar aqui para caber.
    /// </summary>
    private const int TamanhoDoRegistro = 4096;

    private static readonly TimeSpan ValidadeDoToken = TimeSpan.FromHours(6);

    public async Task<ResultadoDoEnvio> EnviarAsync(
        InscricaoPush inscricao,
        string cargaJson,
        int ttlSegundos = 3600,
        CancellationToken ct = default)
    {
        try
        {
            var corpo = Cifrar(Encoding.UTF8.GetBytes(cargaJson), inscricao);

            var pedido = new HttpRequestMessage(HttpMethod.Post, inscricao.Endpoint)
            {
                Content = new ByteArrayContent(corpo)
            };

            pedido.Content.Headers.ContentType = new("application/octet-stream");
            pedido.Content.Headers.ContentEncoding.Add("aes128gcm");

            pedido.Headers.TryAddWithoutValidation("TTL", ttlSegundos.ToString());
            pedido.Headers.TryAddWithoutValidation("Urgency", "normal");
            pedido.Headers.TryAddWithoutValidation(
                "Authorization", CabecalhoVapid(new Uri(inscricao.Endpoint)));

            using var resposta = await http.SendAsync(pedido, ct);

            // 404 e 410 são a maneira de o serviço de push dizer que aquele
            // navegador não existe mais. Insistir só gera ruído no log para
            // sempre; a inscrição é descartada por quem chamou.
            if (resposta.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
                return ResultadoDoEnvio.InscricaoMorta;

            return resposta.IsSuccessStatusCode
                ? ResultadoDoEnvio.Aceito
                : ResultadoDoEnvio.Falhou;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            // Rede caída, endpoint malformado, chave estragada: nada disso pode
            // interromper uma atualização. O aviso na faixa da tela já saiu.
            return ResultadoDoEnvio.Falhou;
        }
    }

    // ------------------------------------------------------------------ VAPID

    /// <summary>
    /// Monta o `Authorization: vapid t=<jwt>, k=<chave>`.
    ///
    /// A audiência é a origem do endpoint, e só ela — incluir o caminho faz o
    /// serviço de push rejeitar com 401 sem explicar.
    /// </summary>
    private string CabecalhoVapid(Uri endpoint)
    {
        var audiencia = $"{endpoint.Scheme}://{endpoint.Host}";

        var cabecalho = Base64Url.Codificar(
            Encoding.UTF8.GetBytes("""{"typ":"JWT","alg":"ES256"}"""));

        var expiracao = DateTimeOffset.UtcNow.Add(ValidadeDoToken).ToUnixTimeSeconds();

        var conteudo = Base64Url.Codificar(Encoding.UTF8.GetBytes(
            JsonSerializer.Serialize(new Dictionary<string, object>
            {
                ["aud"] = audiencia,
                ["exp"] = expiracao,
                ["sub"] = contato
            })));

        var assinado = $"{cabecalho}.{conteudo}";

        using var ec = chaves.AbrirParaAssinar();

        // O JWS pede a assinatura crua (r||s de 64 bytes), não o DER. É o
        // formato que o SignData do .NET devolve por padrão.
        var assinatura = ec.SignData(
            Encoding.UTF8.GetBytes(assinado), HashAlgorithmName.SHA256);

        var jwt = $"{assinado}.{Base64Url.Codificar(assinatura)}";

        return $"vapid t={jwt}, k={chaves.PublicaBase64Url}";
    }

    // ------------------------------------------------------------------ cifra

    /// <summary>
    /// Cifra a carga no formato `aes128gcm` (RFC 8188), com a chave derivada
    /// como manda a RFC 8291.
    ///
    /// O caminho, em ordem: um par efêmero de chaves nosso; o segredo ECDH com
    /// a chave do navegador; esse segredo esticado com o `auth` da inscrição
    /// para virar material de chave; e daí a chave de conteúdo e o nonce. O
    /// resultado carrega no próprio corpo tudo que o navegador precisa para
    /// desfazer o caminho — sal e nossa chave pública viajam em claro.
    /// </summary>
    private static byte[] Cifrar(byte[] texto, InscricaoPush inscricao)
    {
        var chaveDoNavegador = Base64Url.Decodificar(inscricao.P256dh);
        var segredoDeAutenticacao = Base64Url.Decodificar(inscricao.Auth);

        if (chaveDoNavegador.Length != 65 || chaveDoNavegador[0] != 0x04)
            throw new CryptographicException("p256dh da inscrição não é um ponto EC válido");

        using var efemera = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        var nossaPublica = ChavesVapid.PontoNaoComprimido(
            efemera.ExportParameters(false).Q);

        using var doNavegador = ECDiffieHellman.Create(new ECParameters
        {
            Curve = ECCurve.NamedCurves.nistP256,
            Q = new ECPoint
            {
                X = chaveDoNavegador.AsSpan(1, 32).ToArray(),
                Y = chaveDoNavegador.AsSpan(33, 32).ToArray()
            }
        });

        var segredoCompartilhado = efemera.DeriveRawSecretAgreement(doNavegador.PublicKey);

        // Primeira derivação: liga o segredo ECDH ao `auth`, que só o navegador
        // e o servidor conhecem. É o que impede o serviço de push de forjar.
        var prkDaChave = HKDF.Extract(
            HashAlgorithmName.SHA256, segredoCompartilhado, segredoDeAutenticacao);

        var infoDaChave = Concatenar(
            Encoding.ASCII.GetBytes("WebPush: info"),
            new byte[] { 0 },
            chaveDoNavegador,
            nossaPublica);

        var materialDeChave = HKDF.Expand(HashAlgorithmName.SHA256, prkDaChave, 32, infoDaChave);

        var sal = RandomNumberGenerator.GetBytes(16);
        var prk = HKDF.Extract(HashAlgorithmName.SHA256, materialDeChave, sal);

        var chaveDeConteudo = HKDF.Expand(
            HashAlgorithmName.SHA256, prk, 16, ComTerminador("Content-Encoding: aes128gcm"));

        var nonce = HKDF.Expand(
            HashAlgorithmName.SHA256, prk, 12, ComTerminador("Content-Encoding: nonce"));

        // 0x02 marca o fim do último (e único) registro. Sem esse byte o
        // navegador descarta a mensagem sem avisar ninguém.
        var comDelimitador = Concatenar(texto, new byte[] { 0x02 });

        var cifrado = new byte[comDelimitador.Length];
        var etiqueta = new byte[16];

        using (var aes = new AesGcm(chaveDeConteudo, 16))
        {
            aes.Encrypt(nonce, comDelimitador, cifrado, etiqueta);
        }

        var tamanhoDoRegistro = new byte[4];
        BitConverter.TryWriteBytes(tamanhoDoRegistro, TamanhoDoRegistro);
        if (BitConverter.IsLittleEndian) Array.Reverse(tamanhoDoRegistro);

        return Concatenar(
            sal,
            tamanhoDoRegistro,
            new byte[] { (byte)nossaPublica.Length },
            nossaPublica,
            cifrado,
            etiqueta);
    }

    private static byte[] ComTerminador(string texto) =>
        Concatenar(Encoding.ASCII.GetBytes(texto), new byte[] { 0 });

    private static byte[] Concatenar(params byte[][] partes)
    {
        var total = new byte[partes.Sum(p => p.Length)];
        var posicao = 0;

        foreach (var parte in partes)
        {
            parte.CopyTo(total, posicao);
            posicao += parte.Length;
        }

        return total;
    }
}
