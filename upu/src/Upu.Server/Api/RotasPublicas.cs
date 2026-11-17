using Upu.Core.Armazenamento;
using Upu.Core.Modelos;
using Upu.Core.Notificacoes;

namespace Upu.Server.Api;

/// <summary>
/// As rotas que o navegador do usuário final alcança. Nenhuma delas exige
/// senha, e nenhuma delas muda nada da produção.
///
/// O que elas podem fazer é o limite deliberado: ler os avisos que já são
/// públicos por natureza (estão na tela de todo mundo) e registrar uma
/// inscrição de push. Uma inscrição não identifica pessoa nem empresa — é uma
/// URL opaca do serviço de push mais duas chaves —, e por isso não há nada aqui
/// que dependa de saber quem é quem.
///
/// Costumam ser alcançadas por `/upu/*`, encaminhado pelo servidor do frontend
/// para cá, de modo que tudo fique na mesma origem que o usuário já abriu.
/// </summary>
public static class RotasPublicas
{
    public static void MapearRotasPublicas(this WebApplication app)
    {
        var grupo = app.MapGroup("/publico");

        // Feed de avisos. O widget prefere o arquivo estático, e cai aqui
        // quando o encaminhamento existe: assim um build em andamento, que
        // apaga a pasta, não deixa o usuário sem aviso.
        grupo.MapGet("/avisos", (Deposito deposito) =>
        {
            var agora = DateTimeOffset.Now;

            return Results.Json(new FeedDeAvisos
            {
                GeradoEm = agora,
                VersaoNoAr = deposito.VersaoNoAr,
                ApiPublica = deposito.Configuracao.CaminhoPublicoDoUpu,
                ChaveVapid = deposito.Configuracao.VapidPublica,
                Avisos = deposito.Avisos
                    .Where(a => a.EstaValido(agora))
                    .OrderByDescending(a => a.PublicadoEm)
                    .ToList()
            }, Deposito.Json);
        });

        // A versão no ar, para quem só quer mostrar num rodapé.
        grupo.MapGet("/versao", (Deposito deposito) =>
        {
            var release = deposito.ReleaseNoAr;

            return Results.Json(new
            {
                versao = release?.Versao,
                titulo = release?.Titulo,
                publicadaEm = release?.ConcluidaEm
            }, Deposito.Json);
        });

        grupo.MapGet("/chave-vapid", (Deposito deposito) =>
            Results.Json(new { chave = deposito.Configuracao.VapidPublica }, Deposito.Json));

        // Guarda a inscrição de push do navegador.
        //
        // Idempotente pelo endpoint: o navegador reenvia a mesma inscrição a
        // cada carregamento da página, e criar uma linha nova a cada vez faria
        // o mesmo usuário receber a notificação dez vezes.
        grupo.MapPost("/inscrever", async (
            PedidoDeInscricao pedido, Deposito deposito, HttpContext ctx, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(pedido.Endpoint) ||
                string.IsNullOrWhiteSpace(pedido.P256dh) ||
                string.IsNullOrWhiteSpace(pedido.Auth))
            {
                return Results.BadRequest(new { erro = "inscrição incompleta" });
            }

            if (!Uri.TryCreate(pedido.Endpoint, UriKind.Absolute, out var endereco) ||
                endereco.Scheme != Uri.UriSchemeHttps)
            {
                return Results.BadRequest(new { erro = "endpoint precisa ser uma URL https" });
            }

            var existente = deposito.Inscricoes
                .FirstOrDefault(i => i.Endpoint == pedido.Endpoint);

            await deposito.SalvarInscricaoAsync(new InscricaoPush
            {
                Endpoint = pedido.Endpoint,
                P256dh = pedido.P256dh,
                Auth = pedido.Auth,
                InscritoEm = existente?.InscritoEm ?? DateTimeOffset.Now,
                AgenteDoUsuario = ctx.Request.Headers.UserAgent.ToString() is { Length: > 0 } ua
                    ? ua[..Math.Min(ua.Length, 200)]
                    : null
            }, ct);

            return Results.Ok(new { ok = true });
        });

        grupo.MapPost("/desinscrever", async (
            PedidoDeDesinscricao pedido, Deposito deposito, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(pedido.Endpoint))
                return Results.BadRequest(new { erro = "endpoint não informado" });

            await deposito.RemoverInscricoesAsync(new[] { pedido.Endpoint }, ct);
            return Results.Ok(new { ok = true });
        });
    }

    public sealed record PedidoDeInscricao(string Endpoint, string P256dh, string Auth);
    public sealed record PedidoDeDesinscricao(string Endpoint);
}
