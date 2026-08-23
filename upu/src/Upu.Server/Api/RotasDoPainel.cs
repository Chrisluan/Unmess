using System.Text.Json;
using System.Threading.Channels;
using Upu.Core.Armazenamento;
using Upu.Core.Deploy;
using Upu.Core.Git;
using Upu.Core.Modelos;
using Upu.Core.Notificacoes;
using Upu.Core.Registro;
using Upu.Core.Validacao;
using Upu.Server.Seguranca;
using Upu.Server.Trabalhadores;

namespace Upu.Server.Api;

/// <summary>
/// A API que o painel do UPU consome. Tudo aqui exige sessão, menos entrar e
/// definir a senha na primeira execução.
///
/// O desenho segue uma regra: a rota devolve o mesmo objeto que o painel mostra,
/// já pronto. Nada de o navegador juntar três chamadas para montar uma tela —
/// numa máquina que está atendendo cliente, cada requisição a mais no laço de
/// atualização do painel é CPU que sai de algum lugar.
/// </summary>
public static class RotasDoPainel
{
    public static void MapearRotasDoPainel(this WebApplication app)
    {
        MapearPortaria(app);
        MapearProtegidas(app);
    }

    // ------------------------------------------------------------- portaria

    private static void MapearPortaria(WebApplication app)
    {
        var portaria = app.MapGroup("/api");

        portaria.MapGet("/situacao", (Autenticacao auth, HttpContext ctx) => Results.Json(new
        {
            senhaDefinida = auth.SenhaDefinida,
            autenticado = auth.SessaoValida(ctx.Request.Cookies[Autenticacao.NomeDoCookie])
        }, Deposito.Json));

        portaria.MapPost("/definir-senha", async (
            PedidoDeSenha pedido, Autenticacao auth, Diario diario, CancellationToken ct) =>
        {
            var erro = await auth.DefinirSenhaAsync(pedido.Senha ?? "", ct);
            if (erro is not null) return Results.BadRequest(new { erro });

            diario.Ok("senha do painel definida");
            return Results.Ok(new { ok = true });
        });

        portaria.MapPost("/entrar", (
            PedidoDeSenha pedido, Autenticacao auth, HttpContext ctx, Diario diario) =>
        {
            var origem = ctx.Connection.RemoteIpAddress?.ToString() ?? "desconhecido";
            var resultado = auth.Entrar(pedido.Senha ?? "", origem);

            if (!resultado.Certa)
            {
                diario.Atencao($"tentativa de entrada recusada ({origem}): {resultado.Erro}");
                return Results.Json(new { erro = resultado.Erro }, Deposito.Json, statusCode: 401);
            }

            ctx.Response.Cookies.Append(Autenticacao.NomeDoCookie, resultado.Token!, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Strict,
                // Sem `Secure`: a instalação atende em http na rede local, e um
                // cookie seguro simplesmente não seria enviado — a pessoa
                // entraria e continuaria deslogada, sem mensagem nenhuma.
                Secure = ctx.Request.IsHttps,
                MaxAge = TimeSpan.FromHours(8)
            });

            return Results.Ok(new { ok = true });
        });

        portaria.MapPost("/sair", (Autenticacao auth, HttpContext ctx) =>
        {
            auth.Sair(ctx.Request.Cookies[Autenticacao.NomeDoCookie]);
            ctx.Response.Cookies.Delete(Autenticacao.NomeDoCookie);
            return Results.Ok(new { ok = true });
        });
    }

    // ------------------------------------------------------------ protegidas

    private static void MapearProtegidas(WebApplication app)
    {
        var grupo = app.MapGroup("/api").AddEndpointFilter(async (contexto, proximo) =>
        {
            var ctx = contexto.HttpContext;
            var auth = ctx.RequestServices.GetRequiredService<Autenticacao>();

            if (!auth.SessaoValida(ctx.Request.Cookies[Autenticacao.NomeDoCookie]))
                return Results.Json(new { erro = "sessão expirada" }, statusCode: 401);

            return await proximo(contexto);
        });

        MapearEstado(grupo);
        MapearReleases(grupo);
        MapearAvisos(grupo);
        MapearConfiguracao(grupo);
        MapearDiario(grupo);
    }

    // --------------------------------------------------------------- estado

    private static void MapearEstado(RouteGroupBuilder grupo)
    {
        // O retrato da instalação. É o que o painel busca a cada poucos
        // segundos, então não fala com a rede: nada de `git fetch` aqui.
        grupo.MapGet("/estado", async (
            Deposito deposito,
            Repositorio repositorio,
            ControleDeServico controle,
            SondaDeSaude sonda,
            Executor executor,
            Agendador agendador,
            CancellationToken ct) =>
        {
            var configuracao = deposito.Configuracao;

            var servicos = new List<object>();
            foreach (var servico in configuracao.Servicos)
            {
                var estado = await controle.ConsultarAsync(servico.Servico, ct);

                servicos.Add(new
                {
                    id = servico.Id,
                    rotulo = servico.Rotulo,
                    servico = servico.Servico,
                    porta = servico.Porta,
                    estado = estado.Estado,
                    rodando = estado.Rodando,
                    respondendo = servico.Porta > 0 && await sonda.PortaRespondeAsync(servico.Porta, ct)
                });
            }

            object git;
            try
            {
                git = new
                {
                    branch = configuracao.Branch,
                    branchAtual = await repositorio.BranchAtualAsync(),
                    commitAtual = await repositorio.CommitAtualAsync(),
                    resumo = await repositorio.ResumoAsync("HEAD"),
                    pendentes = await repositorio.AlteracoesPendentesAsync()
                };
            }
            catch (ErroDeGit erro)
            {
                git = new { erro = erro.Message };
            }

            var noAr = deposito.ReleaseNoAr;

            return Results.Json(new
            {
                versaoNoAr = noAr?.Versao,
                releaseNoAr = noAr,
                servicos,
                git,
                emAndamento = executor.EmAndamento,
                proximaAgendada = agendador.ProximaAgendada,
                vigiando = configuracao.VigiarBranch,
                inscritos = deposito.Inscricoes.Count,
                pushLigado = configuracao.VapidPublica is not null
            }, Deposito.Json);
        });

        // Fala com o GitHub: só quando alguém pede. Devolve o que entraria na
        // produção se uma release apontasse para a ponta da branch.
        grupo.MapGet("/branch", async (Repositorio repositorio, Deposito deposito) =>
        {
            var configuracao = deposito.Configuracao;

            try
            {
                await repositorio.BuscarAsync(configuracao.Branch);

                var atual = await repositorio.CommitAtualAsync();
                var remoto = await repositorio.CommitRemotoAsync(configuracao.Branch);

                return Results.Json(new
                {
                    branch = configuracao.Branch,
                    commitAtual = atual,
                    commitRemoto = remoto,
                    atualizado = string.Equals(atual, remoto, StringComparison.OrdinalIgnoreCase),
                    commits = await repositorio.CommitsEntreAsync(atual, remoto)
                }, Deposito.Json);
            }
            catch (ErroDeGit erro)
            {
                return Results.Json(new { erro = erro.Message }, Deposito.Json, statusCode: 502);
            }
        });

        // O que acontece se esta release for aplicada, antes de aplicar.
        grupo.MapGet("/previsao/{commit}", async (string commit, Executor executor) =>
        {
            try
            {
                return Results.Json(await executor.PreverAsync(commit), Deposito.Json);
            }
            catch (Exception erro)
            {
                return Results.Json(new { erro = erro.Message }, Deposito.Json, statusCode: 400);
            }
        });
    }

    // ------------------------------------------------------------- releases

    private static void MapearReleases(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/releases", (Deposito deposito) =>
            Results.Json(deposito.Releases, Deposito.Json));

        grupo.MapGet("/releases/{id}", (string id, Deposito deposito) =>
            deposito.BuscarRelease(id) is { } release
                ? Results.Json(release, Deposito.Json)
                : Results.NotFound(new { erro = "release não encontrada" }));

        // Cria ou atualiza o rascunho. Devolve sempre a lista de erros de campo,
        // mesmo quando salva: é assim que o formulário vai marcando o que falta
        // enquanto a pessoa escreve, em vez de só reclamar no fim.
        grupo.MapPost("/releases", async (
            FormularioDeRelease formulario, Deposito deposito, CancellationToken ct) =>
        {
            var release = formulario.Id is { Length: > 0 } id
                ? deposito.BuscarRelease(id)
                : null;

            if (release is not null && !release.PodeSerEditada)
            {
                return Results.Json(new
                {
                    erro = $"esta release está {release.Estado} e não pode mais ser editada"
                }, Deposito.Json, statusCode: 409);
            }

            release ??= new Release();
            formulario.AplicarEm(release);

            var erros = ValidadorDeRelease.Validar(release, deposito.VersaoNoAr, DateTimeOffset.Now);

            await deposito.SalvarReleaseAsync(release, ct);

            return Results.Json(new { release, erros }, Deposito.Json);
        });

        // Agenda: exige os campos completos. É aqui que o portão fecha.
        grupo.MapPost("/releases/{id}/agendar", async (
            string id, Deposito deposito, Diario diario, CancellationToken ct) =>
        {
            var release = deposito.BuscarRelease(id);
            if (release is null) return Results.NotFound(new { erro = "release não encontrada" });

            if (!release.PodeSerEditada)
                return Results.Json(new { erro = $"release já está {release.Estado}" },
                    Deposito.Json, statusCode: 409);

            var erros = ValidadorDeRelease.Validar(release, deposito.VersaoNoAr, DateTimeOffset.Now);
            if (erros.Count > 0)
                return Results.Json(new { erros }, Deposito.Json, statusCode: 422);

            if (release.Janela is null)
                return Results.Json(new
                {
                    erros = new[]
                    {
                        new ErroDeCampo("janela",
                            "Para agendar é preciso um horário. Sem horário, use \"aplicar agora\".")
                    }
                }, Deposito.Json, statusCode: 422);

            release.Estado = EstadoDaRelease.Agendada;
            await deposito.SalvarReleaseAsync(release, ct);

            diario.Ok($"versão {release.Versao} agendada para {release.Janela:dd/MM HH\\:mm} " +
                      $"(aviso {release.AvisoPrevioMinutos} min antes)");

            return Results.Json(release, Deposito.Json);
        });

        // Aplicar agora. Mesmo portão: o botão não pula a validação.
        // Sem `async`: esta rota não espera nada. Ela larga o pipeline rodando e
        // responde de imediato, porque um deploy leva minutos e a requisição
        // morreria muito antes.
        grupo.MapPost("/releases/{id}/aplicar", (
            string id, Deposito deposito, Executor executor) =>
        {
            var release = deposito.BuscarRelease(id);
            if (release is null) return Results.NotFound(new { erro = "release não encontrada" });

            if (release.Estado is EstadoDaRelease.Aplicando)
                return Results.Json(new { erro = "esta release já está sendo aplicada" },
                    Deposito.Json, statusCode: 409);

            var erros = ValidadorDeRelease.Validar(release, deposito.VersaoNoAr, DateTimeOffset.Now)
                .Where(e => e.Campo != "janela")
                .ToList();

            if (erros.Count > 0)
                return Results.Json(new { erros }, Deposito.Json, statusCode: 422);

            // O painel acompanha pelo diário ao vivo.
            _ = Task.Run(async () =>
            {
                try { await executor.AplicarAsync(release, CancellationToken.None); }
                catch { /* o executor já registrou e desfez */ }
            }, CancellationToken.None);

            return Results.Accepted($"/api/releases/{release.Id}", new { ok = true });
        });

        grupo.MapPost("/releases/{id}/cancelar", async (
            string id, Deposito deposito, Publicador publicador, Diario diario, CancellationToken ct) =>
        {
            var release = deposito.BuscarRelease(id);
            if (release is null) return Results.NotFound(new { erro = "release não encontrada" });

            if (release.Estado == EstadoDaRelease.Aplicando)
                return Results.Json(new
                {
                    erro = "não dá para cancelar no meio da aplicação; ela se desfaz sozinha se falhar"
                }, Deposito.Json, statusCode: 409);

            release.Estado = EstadoDaRelease.Cancelada;
            await deposito.SalvarReleaseAsync(release, ct);

            // O aviso prévio já pode estar na tela de todo mundo.
            await deposito.RemoverAvisosDaReleaseAsync(release.Id, ct);
            await publicador.RepublicarFeedAsync(ct);

            diario.Nota($"versão {release.Versao} cancelada");
            return Results.Json(release, Deposito.Json);
        });

        grupo.MapDelete("/releases/{id}", async (
            string id, Deposito deposito, CancellationToken ct) =>
        {
            var release = deposito.BuscarRelease(id);
            if (release is null) return Results.NotFound(new { erro = "release não encontrada" });

            // Histórico não se apaga: uma release que chegou a rodar é o registro
            // do que aconteceu com a produção.
            if (release.Estado is not (EstadoDaRelease.Rascunho or EstadoDaRelease.Cancelada))
                return Results.Json(new
                {
                    erro = "só rascunho e release cancelada podem ser apagados"
                }, Deposito.Json, statusCode: 409);

            await deposito.RemoverReleaseAsync(id, ct);
            return Results.Ok(new { ok = true });
        });
    }

    // --------------------------------------------------------------- avisos

    private static void MapearAvisos(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/avisos", (Deposito deposito) =>
            Results.Json(deposito.Avisos.OrderByDescending(a => a.PublicadoEm), Deposito.Json));

        // Aviso escrito à mão: promoção, recado de configuração, qualquer coisa
        // que o sistema precise dizer para todo mundo pelo mesmo lugar.
        grupo.MapPost("/avisos", async (
            FormularioDeAviso formulario, Publicador publicador, CancellationToken ct) =>
        {
            if ((formulario.Titulo?.Trim().Length ?? 0) < 3)
                return Results.BadRequest(new { erro = "o aviso precisa de um título" });

            if ((formulario.Mensagem?.Trim().Length ?? 0) < 5)
                return Results.BadRequest(new { erro = "o aviso precisa de uma mensagem" });

            var aviso = new Aviso
            {
                Tipo = Enum.TryParse<TipoDeAviso>(formulario.Tipo, true, out var tipo)
                    ? tipo : TipoDeAviso.Geral,
                Severidade = Enum.TryParse<SeveridadeDoAviso>(formulario.Severidade, true, out var sev)
                    ? sev : SeveridadeDoAviso.Informacao,
                Titulo = formulario.Titulo!.Trim(),
                Mensagem = formulario.Mensagem!.Trim(),
                Detalhes = formulario.Detalhes?.Where(d => !string.IsNullOrWhiteSpace(d)).ToList() ?? new(),
                Link = string.IsNullOrWhiteSpace(formulario.Link) ? null : formulario.Link.Trim(),
                RotuloDoLink = string.IsNullOrWhiteSpace(formulario.RotuloDoLink)
                    ? null : formulario.RotuloDoLink.Trim(),
                Dispensavel = formulario.Dispensavel ?? true,
                NotificarNavegador = formulario.NotificarNavegador ?? true,
                ExpiraEm = formulario.ExpiraEmMinutos is int minutos && minutos > 0
                    ? DateTimeOffset.Now.AddMinutes(minutos)
                    : null
            };

            await publicador.PublicarAsync(aviso, ct);
            return Results.Json(aviso, Deposito.Json);
        });

        grupo.MapDelete("/avisos/{id}", async (
            string id, Publicador publicador, CancellationToken ct) =>
        {
            await publicador.RemoverAsync(id, ct);
            return Results.Ok(new { ok = true });
        });
    }

    // --------------------------------------------------------- configuração

    private static void MapearConfiguracao(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/configuracao", (Deposito deposito) =>
        {
            var c = deposito.Configuracao;

            // A chave privada VAPID e o hash da senha nunca saem daqui.
            return Results.Json(new
            {
                c.Raiz,
                c.Branch,
                c.EnderecoDeEscuta,
                c.Servicos,
                c.PastaPublicaDoFrontend,
                c.CaminhoPublicoDoUpu,
                c.JanelaPadrao,
                c.AvisoPrevioPadraoMinutos,
                c.VigiarBranch,
                c.IntervaloDeVigiaMinutos,
                c.Webhook,
                c.ContatoVapid,
                c.DuracaoDoAvisoDeConclusaoMinutos,
                c.VapidPublica,
                senhaDefinidaEm = c.SenhaDefinidaEm
            }, Deposito.Json);
        });

        grupo.MapPut("/configuracao", async (
            FormularioDeConfiguracao formulario, Deposito deposito, Publicador publicador,
            Diario diario, CancellationToken ct) =>
        {
            await deposito.AlterarConfiguracaoAsync(c =>
            {
                if (formulario.Branch is { Length: > 0 }) c.Branch = formulario.Branch.Trim();
                if (formulario.JanelaPadrao is { Length: > 0 }) c.JanelaPadrao = formulario.JanelaPadrao.Trim();
                if (formulario.AvisoPrevioPadraoMinutos is int a) c.AvisoPrevioPadraoMinutos = a;
                if (formulario.VigiarBranch is bool v) c.VigiarBranch = v;
                if (formulario.IntervaloDeVigiaMinutos is int i) c.IntervaloDeVigiaMinutos = Math.Max(1, i);
                if (formulario.DuracaoDoAvisoDeConclusaoMinutos is int d)
                    c.DuracaoDoAvisoDeConclusaoMinutos = Math.Max(1, d);
                if (formulario.CaminhoPublicoDoUpu is { Length: > 0 })
                    c.CaminhoPublicoDoUpu = formulario.CaminhoPublicoDoUpu.Trim();
                if (formulario.ContatoVapid is { Length: > 0 }) c.ContatoVapid = formulario.ContatoVapid.Trim();

                // String vazia desliga o webhook; nulo mantém o que estava.
                if (formulario.Webhook is not null)
                    c.Webhook = formulario.Webhook.Trim() is { Length: > 0 } w ? w : null;
            }, ct);

            diario.Nota("configuração alterada pelo painel");

            // O feed carrega o caminho público e a chave; se mudaram, o widget
            // precisa ver a mudança sem esperar o próximo aviso.
            await publicador.RepublicarFeedAsync(ct);

            return Results.Ok(new { ok = true });
        });
    }

    // --------------------------------------------------------------- diário

    private static void MapearDiario(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/diario", (Diario diario, int? linhas) =>
            Results.Json(diario.Recentes(linhas ?? 200), Deposito.Json));

        // Acompanhamento ao vivo por SSE. Enquanto o deploy roda, é o que faz a
        // diferença entre "está trabalhando" e "travou".
        grupo.MapGet("/diario/ao-vivo", async (HttpContext ctx, Diario diario, CancellationToken ct) =>
        {
            ctx.Response.Headers.ContentType = "text/event-stream";
            ctx.Response.Headers.CacheControl = "no-cache";
            ctx.Response.Headers["X-Accel-Buffering"] = "no";

            var fila = Channel.CreateUnbounded<LinhaDeDiario>();
            void Ouvir(LinhaDeDiario linha) => fila.Writer.TryWrite(linha);

            foreach (var linha in diario.Recentes(50)) fila.Writer.TryWrite(linha);
            diario.Escreveu += Ouvir;

            try
            {
                await foreach (var linha in fila.Reader.ReadAllAsync(ct))
                {
                    await ctx.Response.WriteAsync(
                        $"data: {JsonSerializer.Serialize(linha, Deposito.Json)}\n\n", ct);
                    await ctx.Response.Body.FlushAsync(ct);
                }
            }
            catch (OperationCanceledException)
            {
                // O painel fechou a aba. Normal.
            }
            finally
            {
                diario.Escreveu -= Ouvir;
            }
        });
    }

    // ----------------------------------------------------------------- DTOs

    public sealed record PedidoDeSenha(string? Senha);

    /// <summary>
    /// O que o formulário do painel pode mexer.
    ///
    /// É um tipo separado da <see cref="Release"/> de propósito: estado, passos
    /// e datas de execução são escritos pelo executor, e aceitar isso vindo do
    /// navegador deixaria alguém marcar uma release como "concluída" sem que
    /// nada tivesse subido.
    /// </summary>
    public sealed record FormularioDeRelease(
        string? Id,
        string? Versao,
        string? Titulo,
        string? Tipo,
        string? ResumoParaUsuarios,
        List<string>? Alteracoes,
        string? Impacto,
        int? DuracaoEstimadaMinutos,
        string? Responsavel,
        string? CommitAlvo,
        string? PlanoDeVolta,
        bool? TestadoEmDesenvolvimento,
        bool? Forcar,
        DateTimeOffset? Janela,
        int? AvisoPrevioMinutos,
        string? CriadaPor)
    {
        public void AplicarEm(Release release)
        {
            release.Versao = Versao?.Trim() ?? "";
            release.Titulo = Titulo?.Trim() ?? "";
            release.ResumoParaUsuarios = ResumoParaUsuarios?.Trim() ?? "";
            release.Responsavel = Responsavel?.Trim() ?? "";
            release.CommitAlvo = CommitAlvo?.Trim() ?? "";
            release.PlanoDeVolta = PlanoDeVolta?.Trim() ?? "";
            release.TestadoEmDesenvolvimento = TestadoEmDesenvolvimento ?? false;
            release.Forcar = Forcar ?? false;
            release.Janela = Janela;
            release.DuracaoEstimadaMinutos = DuracaoEstimadaMinutos;

            release.Alteracoes = Alteracoes?
                .Select(a => a?.Trim() ?? "")
                .Where(a => a.Length > 0)
                .ToList() ?? new List<string>();

            release.Tipo = Enum.TryParse<TipoDeRelease>(Tipo, true, out var tipo) ? tipo : null;
            release.Impacto = Enum.TryParse<ImpactoNoUso>(Impacto, true, out var impacto) ? impacto : null;

            if (AvisoPrevioMinutos is int minutos) release.AvisoPrevioMinutos = minutos;
            if (CriadaPor is { Length: > 0 } quem) release.CriadaPor = quem.Trim();
        }
    }

    public sealed record FormularioDeAviso(
        string? Tipo,
        string? Severidade,
        string? Titulo,
        string? Mensagem,
        List<string>? Detalhes,
        string? Link,
        string? RotuloDoLink,
        bool? Dispensavel,
        bool? NotificarNavegador,
        int? ExpiraEmMinutos);

    public sealed record FormularioDeConfiguracao(
        string? Branch,
        string? JanelaPadrao,
        int? AvisoPrevioPadraoMinutos,
        bool? VigiarBranch,
        int? IntervaloDeVigiaMinutos,
        int? DuracaoDoAvisoDeConclusaoMinutos,
        string? CaminhoPublicoDoUpu,
        string? ContatoVapid,
        string? Webhook);
}
