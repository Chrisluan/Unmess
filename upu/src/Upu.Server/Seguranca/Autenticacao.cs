using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Upu.Core.Armazenamento;

namespace Upu.Server.Seguranca;

/// <summary>
/// A senha entre um curioso e o botão que troca a produção inteira.
///
/// O UPU aplica código novo, reinicia serviços e escreve na tela de todos os
/// clientes. Isso é mais poder do que o painel de operação tem — então as
/// mesmas precauções, e uma a mais: a senha nunca é gravada, só o resultado de
/// derivá-la 210 mil vezes.
///
/// As sessões vivem em memória de propósito. Reiniciar o UPU derruba todo
/// mundo, que é exatamente o que se quer de uma ferramenta administrativa: o
/// acesso não sobrevive a um reinício que ninguém explicou.
/// </summary>
public sealed class Autenticacao(Deposito deposito)
{
    public const string NomeDoCookie = "upu_sessao";

    private const int Iteracoes = 210_000;
    private const int TamanhoDoHash = 32;
    private const int TamanhoMinimoDaSenha = 8;

    private static readonly TimeSpan DuracaoDaSessao = TimeSpan.FromHours(8);
    private static readonly TimeSpan Bloqueio = TimeSpan.FromMinutes(5);
    private const int MaximoDeTentativas = 5;

    private sealed record Sessao(DateTimeOffset Expira, string Origem);
    private sealed class Tentativas
    {
        public int Contador;
        public DateTimeOffset? BloqueadoAte;
    }

    private readonly ConcurrentDictionary<string, Sessao> _sessoes = new();
    private readonly ConcurrentDictionary<string, Tentativas> _tentativas = new();

    public bool SenhaDefinida => !string.IsNullOrEmpty(deposito.Configuracao.SenhaHash);

    // ------------------------------------------------------------- definir

    /// <summary>
    /// Define a senha. Só funciona enquanto não houver uma — trocar exige apagar
    /// os campos no `configuracao.json`, o que pede acesso à máquina.
    /// </summary>
    public async Task<string?> DefinirSenhaAsync(string senha, CancellationToken ct = default)
    {
        if (SenhaDefinida) return "a senha já foi definida nesta instalação";

        if (senha.Length < TamanhoMinimoDaSenha)
            return $"a senha precisa ter pelo menos {TamanhoMinimoDaSenha} caracteres";

        var sal = RandomNumberGenerator.GetBytes(16);
        var hash = Derivar(senha, sal);

        await deposito.AlterarConfiguracaoAsync(c =>
        {
            c.SenhaSal = Convert.ToHexString(sal);
            c.SenhaHash = Convert.ToHexString(hash);
            c.SenhaDefinidaEm = DateTimeOffset.Now;
        }, ct);

        return null;
    }

    // -------------------------------------------------------------- entrar

    public sealed record ResultadoDeEntrada(bool Certa, string? Token, string? Erro);

    public ResultadoDeEntrada Entrar(string senha, string origem)
    {
        var tentativas = _tentativas.GetOrAdd(origem, _ => new Tentativas());

        lock (tentativas)
        {
            if (tentativas.BloqueadoAte is { } ate && ate > DateTimeOffset.Now)
            {
                var faltam = (int)Math.Ceiling((ate - DateTimeOffset.Now).TotalSeconds);
                return new ResultadoDeEntrada(false, null,
                    $"muitas tentativas; espere {faltam} segundo(s)");
            }
        }

        var configuracao = deposito.Configuracao;

        if (configuracao.SenhaHash is null || configuracao.SenhaSal is null)
            return new ResultadoDeEntrada(false, null, "nenhuma senha foi definida ainda");

        var esperado = Convert.FromHexString(configuracao.SenhaHash);
        var obtido = Derivar(senha, Convert.FromHexString(configuracao.SenhaSal));

        // Comparação de tempo fixo: comparar byte a byte com saída antecipada
        // conta ao atacante quantos caracteres ele já acertou.
        if (!CryptographicOperations.FixedTimeEquals(esperado, obtido))
        {
            lock (tentativas)
            {
                tentativas.Contador++;
                if (tentativas.Contador >= MaximoDeTentativas)
                {
                    tentativas.BloqueadoAte = DateTimeOffset.Now.Add(Bloqueio);
                    tentativas.Contador = 0;
                }
            }

            return new ResultadoDeEntrada(false, null, "senha incorreta");
        }

        lock (tentativas)
        {
            tentativas.Contador = 0;
            tentativas.BloqueadoAte = null;
        }

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        _sessoes[token] = new Sessao(DateTimeOffset.Now.Add(DuracaoDaSessao), origem);

        return new ResultadoDeEntrada(true, token, null);
    }

    public bool SessaoValida(string? token)
    {
        if (string.IsNullOrEmpty(token)) return false;
        if (!_sessoes.TryGetValue(token, out var sessao)) return false;

        if (sessao.Expira <= DateTimeOffset.Now)
        {
            _sessoes.TryRemove(token, out _);
            return false;
        }

        return true;
    }

    public void Sair(string? token)
    {
        if (!string.IsNullOrEmpty(token)) _sessoes.TryRemove(token, out _);
    }

    private static byte[] Derivar(string senha, byte[] sal) =>
        Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(senha), sal, Iteracoes,
            HashAlgorithmName.SHA256, TamanhoDoHash);
}
