using System.Text;
using System.Text.Json;
using Upu.Core.Armazenamento;
using Upu.Core.Modelos;

namespace Upu.Core.Notificacoes;

/// <summary>
/// Repassa cada evento do UPU para uma URL escolhida na configuração.
///
/// É a porta de saída para tudo que não é a tela do usuário: o próprio unmess
/// pode receber aqui e mandar por WhatsApp para o responsável, ou apontar para
/// um canal de equipe. O UPU não tenta falar WhatsApp, Slack ou e-mail — cada
/// um desses seria um formato, uma credencial e um modo de falhar a mais dentro
/// do processo que precisa continuar de pé quando tudo o resto cai.
///
/// Falha de webhook nunca interrompe uma atualização: quem escuta é opcional
/// por definição.
/// </summary>
public sealed class CanalWebhook(HttpClient http)
{
    public async Task<bool> EnviarAsync(
        string? url,
        string evento,
        object carga,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;

        try
        {
            var corpo = JsonSerializer.Serialize(new
            {
                evento,
                momento = DateTimeOffset.Now,
                origem = "upu",
                dados = carga
            }, Deposito.Json);

            using var resposta = await http.PostAsync(
                url,
                new StringContent(corpo, Encoding.UTF8, "application/json"),
                ct);

            return resposta.IsSuccessStatusCode;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return false;
        }
    }

    public Task<bool> AvisoAsync(string? url, Aviso aviso, CancellationToken ct = default) =>
        EnviarAsync(url, $"aviso.{aviso.Tipo}".ToLowerInvariant(), aviso, ct);
}
