using System.Text.RegularExpressions;

namespace Upu.Core.Validacao;

/// <summary>
/// Versão no formato `maior.menor.correcao` com sufixo opcional (`1.4.0-beta`).
///
/// Existe para uma pergunta só: a versão que estão publicando é maior que a que
/// está no ar? Sem isso, um deploy antigo republicado passaria despercebido e o
/// usuário veria a versão andar para trás.
/// </summary>
public readonly record struct Versao(int Maior, int Menor, int Correcao, string Sufixo)
    : IComparable<Versao>
{
    private static readonly Regex Formato =
        new(@"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.\-]+))?$", RegexOptions.Compiled);

    public static bool TentarLer(string? texto, out Versao versao)
    {
        versao = default;
        if (string.IsNullOrWhiteSpace(texto)) return false;

        var m = Formato.Match(texto.Trim());
        if (!m.Success) return false;

        versao = new Versao(
            int.Parse(m.Groups[1].Value),
            int.Parse(m.Groups[2].Value),
            int.Parse(m.Groups[3].Value),
            m.Groups[4].Success ? m.Groups[4].Value : "");

        return true;
    }

    public int CompareTo(Versao outra)
    {
        var c = Maior.CompareTo(outra.Maior);
        if (c != 0) return c;

        c = Menor.CompareTo(outra.Menor);
        if (c != 0) return c;

        c = Correcao.CompareTo(outra.Correcao);
        if (c != 0) return c;

        // Semver: quem tem sufixo é pré-lançamento, e vem antes da versão limpa.
        // `1.4.0-rc1` é menor que `1.4.0`.
        if (Sufixo.Length == 0 && outra.Sufixo.Length == 0) return 0;
        if (Sufixo.Length == 0) return 1;
        if (outra.Sufixo.Length == 0) return -1;

        return string.CompareOrdinal(Sufixo, outra.Sufixo);
    }

    public override string ToString() =>
        Sufixo.Length == 0
            ? $"{Maior}.{Menor}.{Correcao}"
            : $"{Maior}.{Menor}.{Correcao}-{Sufixo}";

    /// <summary>Sugestão para o formulário: a próxima correção da versão no ar.</summary>
    public Versao ProximaCorrecao() => this with { Correcao = Correcao + 1, Sufixo = "" };
}
