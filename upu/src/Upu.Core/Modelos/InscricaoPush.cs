namespace Upu.Core.Modelos;

/// <summary>
/// Uma assinatura de Web Push entregue pelo navegador do usuário.
///
/// Os três campos vêm prontos do `PushSubscription` do navegador: para onde
/// mandar, e as duas chaves que cifram o conteúdo de ponta a ponta — o serviço
/// de push do Google ou da Mozilla encaminha o pacote sem conseguir lê-lo.
/// </summary>
public sealed class InscricaoPush
{
    /// <summary>URL do serviço de push. Serve de identidade da inscrição.</summary>
    public string Endpoint { get; set; } = "";

    /// <summary>Chave pública P-256 do navegador, base64url.</summary>
    public string P256dh { get; set; } = "";

    /// <summary>Segredo de autenticação de 16 bytes, base64url.</summary>
    public string Auth { get; set; } = "";

    public DateTimeOffset InscritoEm { get; set; } = DateTimeOffset.Now;

    /// <summary>Só para diagnóstico: qual navegador é este.</summary>
    public string? AgenteDoUsuario { get; set; }

    /// <summary>
    /// Última vez que o serviço de push aceitou uma entrega. Inscrição que
    /// passa a devolver 404/410 é apagada — o navegador foi desinstalado ou o
    /// usuário revogou a permissão.
    /// </summary>
    public DateTimeOffset? UltimoEnvioAceitoEm { get; set; }

    public int FalhasSeguidas { get; set; }
}
