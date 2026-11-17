using Microsoft.Extensions.DependencyInjection;
using Unmess.Application.Atendimento;
using Unmess.Application.Authentication;
using Unmess.Application.Configuracoes;
using Unmess.Application.Etiquetas;
using Unmess.Application.Filas;
using Unmess.Application.RespostasRapidas;
using Unmess.Application.Empresas;
using Unmess.Application.Permissoes;
using Unmess.Application.Usuarios;

namespace Unmess.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ResolvedorDePermissoes>();
        services.AddScoped<SessionService>();
        services.AddScoped<UsuarioService>();
        services.AddScoped<GrupoDePermissaoService>();
        services.AddScoped<EmpresaService>();
        services.AddScoped<LeitorDeConfiguracoes>();
        services.AddScoped<ConfiguracaoService>();
        services.AddScoped<FilaService>();
        services.AddScoped<EtiquetaService>();
        services.AddScoped<RespostaRapidaService>();
        services.AddScoped<SituacaoDeTicketService>();
        services.AddScoped<HorarioDeAtendimentoService>();
        return services;
    }
}
