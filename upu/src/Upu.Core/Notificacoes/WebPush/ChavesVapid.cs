using System.Security.Cryptography;

namespace Upu.Core.Notificacoes.WebPush;

/// <summary>
/// O par de chaves que identifica este servidor perante os serviços de push.
///
/// VAPID responde a uma pergunta do Google e da Mozilla: "quem é você para
/// mandar notificação para este navegador?". O UPU assina cada envio com a
/// chave privada; o navegador só aceita entregas assinadas com a mesma chave
/// pública que ele guardou no dia em que o usuário permitiu as notificações.
///
/// Consequência prática que vale saber antes de mexer: trocar estas chaves
/// invalida todas as inscrições existentes. Todo mundo teria que permitir de
/// novo, e ninguém permite duas vezes. Elas são geradas uma vez, na primeira
/// execução, e ficam em `dados/configuracao.json`.
/// </summary>
public sealed class ChavesVapid
{
    private readonly byte[] _publica;
    private readonly byte[] _privada;

    private ChavesVapid(byte[] publica, byte[] privada)
    {
        _publica = publica;
        _privada = privada;
    }

    /// <summary>Chave pública em base64url — é o que o navegador recebe.</summary>
    public string PublicaBase64Url => Base64Url.Codificar(_publica);

    public string PrivadaBase64Url => Base64Url.Codificar(_privada);

    /// <summary>Cria um par novo. Só na primeira execução da instalação.</summary>
    public static ChavesVapid Gerar()
    {
        using var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var p = ec.ExportParameters(includePrivateParameters: true);

        return new ChavesVapid(PontoNaoComprimido(p.Q), Preencher(p.D!, 32));
    }

    public static ChavesVapid Ler(string publicaBase64Url, string privadaBase64Url) =>
        new(Base64Url.Decodificar(publicaBase64Url), Base64Url.Decodificar(privadaBase64Url));

    /// <summary>
    /// Reconstrói a chave para assinar.
    ///
    /// O Windows exige a parte pública junto ao importar a privada, mesmo que
    /// ela seja dedutível — por isso as duas são guardadas.
    /// </summary>
    public ECDsa AbrirParaAssinar()
    {
        if (_publica.Length != 65 || _publica[0] != 0x04)
            throw new InvalidOperationException("a chave pública VAPID não está no formato esperado");

        var parametros = new ECParameters
        {
            Curve = ECCurve.NamedCurves.nistP256,
            D = _privada,
            Q = new ECPoint
            {
                X = _publica.AsSpan(1, 32).ToArray(),
                Y = _publica.AsSpan(33, 32).ToArray()
            }
        };

        var ec = ECDsa.Create();
        ec.ImportParameters(parametros);
        return ec;
    }

    /// <summary>Ponto EC no formato 0x04 || X || Y, que é como o Web Push o espera.</summary>
    internal static byte[] PontoNaoComprimido(ECPoint ponto)
    {
        var x = Preencher(ponto.X!, 32);
        var y = Preencher(ponto.Y!, 32);

        var bytes = new byte[65];
        bytes[0] = 0x04;
        x.CopyTo(bytes, 1);
        y.CopyTo(bytes, 33);
        return bytes;
    }

    /// <summary>
    /// Alinha à direita em N bytes.
    ///
    /// O .NET quase sempre devolve os 32 bytes cheios para a P-256, mas quando o
    /// valor começa com zero algumas plataformas encurtam — e um X de 31 bytes
    /// produz uma chave que o navegador rejeita sem dizer por quê.
    /// </summary>
    private static byte[] Preencher(byte[] valor, int tamanho)
    {
        if (valor.Length == tamanho) return valor;
        if (valor.Length > tamanho) return valor[^tamanho..];

        var preenchido = new byte[tamanho];
        valor.CopyTo(preenchido, tamanho - valor.Length);
        return preenchido;
    }
}

/// <summary>
/// Base64 do jeito que a web usa em URL e cabeçalho: `-` e `_` no lugar de `+` e
/// `/`, e sem o `=` de preenchimento no fim.
/// </summary>
public static class Base64Url
{
    public static string Codificar(byte[] dados) =>
        Convert.ToBase64String(dados).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static byte[] Decodificar(string texto)
    {
        var normalizado = texto.Trim().Replace('-', '+').Replace('_', '/');

        // O navegador manda sem preenchimento; o Convert exige múltiplo de 4.
        var faltando = normalizado.Length % 4;
        if (faltando == 2) normalizado += "==";
        else if (faltando == 3) normalizado += "=";
        else if (faltando == 1)
            throw new FormatException("base64url com tamanho inválido");

        return Convert.FromBase64String(normalizado);
    }
}
