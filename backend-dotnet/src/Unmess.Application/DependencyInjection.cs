using Microsoft.Extensions.DependencyInjection;
using Unmess.Application.Authentication;
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
        return services;
    }
}
