using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Unmess.Application.Common;
using Unmess.Application.Conexoes;

namespace Unmess.Application.Tickets;

public sealed class EncerramentoDeInativos(IUnmessDbContext db, TicketService tickets, TimeProvider timeProvider, ILogger<EncerramentoDeInativos> logger)
{
    public async Task ExecutarAsync(CancellationToken cancellationToken)
    {
        var configuracoes = await db.Configuracoes.AsNoTracking().Where(item => item.Chave == "autoCloseInactiveHours").ToListAsync(cancellationToken);
        foreach (var configuracao in configuracoes)
        {
            if (!double.TryParse(configuracao.Valor, NumberStyles.Float, CultureInfo.InvariantCulture, out var horas) || !double.IsFinite(horas) || horas <= 0)
            {
                continue;
            }

            var limite = timeProvider.GetUtcNow().AddHours(-horas);
            var parados = await db.Tickets.AsNoTracking()
                .Where(ticket => ticket.EmpresaId == configuracao.EmpresaId && ticket.AtualizadoEm < limite &&
                                 (ticket.Situacao == SituacoesDoTicket.Aberto || ticket.Situacao == SituacoesDoTicket.Pendente))
                .Select(ticket => ticket.Id)
                .ToListAsync(cancellationToken);

            foreach (var id in parados)
            {
                try
                {
                    await tickets.AtualizarAsync(id, new DadosDoTicket { Situacao = SituacoesDoTicket.Encerrado }, configuracao.EmpresaId, false, cancellationToken);
                }
                catch (AppException exception)
                {
                    logger.LogError(exception, "CloseInactiveTickets: could not close ticket {TicketId}", id);
                }
            }

            if (parados.Count > 0)
            {
                logger.LogInformation("CloseInactiveTickets: {Count} chats closed for company {CompanyId}", parados.Count, configuracao.EmpresaId);
            }
        }
    }
}

public sealed class TarefasEmSegundoPlano(IServiceScopeFactory scopeFactory, TimeProvider timeProvider, ILogger<TarefasEmSegundoPlano> logger) : BackgroundService
{
    public static TimeSpan Intervalo { get; set; } = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ExecutarComSegurancaAsync(async scope => await scope.ServiceProvider.GetRequiredService<ConexaoService>().RetomarTodasAsync(stoppingToken), "resume sessions");

        using var temporizador = new PeriodicTimer(Intervalo, timeProvider);
        while (await temporizador.WaitForNextTickAsync(stoppingToken))
        {
            await ExecutarComSegurancaAsync(async scope => await scope.ServiceProvider.GetRequiredService<EncerramentoDeInativos>().ExecutarAsync(stoppingToken), "close inactive tickets");
        }
    }

    private async Task ExecutarComSegurancaAsync(Func<AsyncServiceScope, Task> trabalho, string nome)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            await trabalho(scope);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogError(exception, "Background task {Task} failed", nome);
        }
    }
}
