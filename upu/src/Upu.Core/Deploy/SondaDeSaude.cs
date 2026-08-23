using System.Net.Sockets;

namespace Upu.Core.Deploy;

/// <summary>
/// Confere se a aplicação subiu de verdade.
///
/// "Running" no Gerenciador de Serviços não prova nada: o NSSM fica de pé e o
/// node atrás dele pode ter morrido dois segundos depois de subir, por uma
/// variável de ambiente faltando ou uma migration pela metade. Só a porta
/// aceitando conexão prova que existe alguém escutando.
///
/// A sonda é de TCP, não de HTTP, de propósito: o frontend responde 404 na raiz
/// dependendo da rota, e o backend pode exigir autenticação. Nenhum dos dois
/// significa que está fora do ar — mas uma conexão recusada significa.
/// </summary>
public sealed class SondaDeSaude
{
    /// <summary>
    /// Tenta conectar até conseguir ou acabar a paciência.
    /// </summary>
    /// <param name="porta">Porta local que a aplicação deveria estar servindo.</param>
    /// <param name="tentativas">Quantas vezes tentar antes de desistir.</param>
    /// <param name="intervalo">Pausa entre as tentativas.</param>
    public async Task<bool> EsperarPortaAsync(
        int porta,
        int tentativas = 20,
        TimeSpan? intervalo = null,
        CancellationToken ct = default)
    {
        var espera = intervalo ?? TimeSpan.FromSeconds(3);

        for (var tentativa = 1; tentativa <= tentativas; tentativa++)
        {
            ct.ThrowIfCancellationRequested();

            if (await PortaRespondeAsync(porta, ct)) return true;

            if (tentativa < tentativas) await Task.Delay(espera, ct);
        }

        return false;
    }

    public async Task<bool> PortaRespondeAsync(int porta, CancellationToken ct = default)
    {
        try
        {
            using var cliente = new TcpClient();
            using var prazo = CancellationTokenSource.CreateLinkedTokenSource(ct);
            prazo.CancelAfter(TimeSpan.FromSeconds(3));

            await cliente.ConnectAsync("127.0.0.1", porta, prazo.Token);
            return cliente.Connected;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return false;
        }
        catch (SocketException)
        {
            return false;
        }
    }
}
