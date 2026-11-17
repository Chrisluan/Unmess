using Unmess.Application.Common;
using Unmess.Application.Permissoes;
using Unmess.Application.Usuarios;
using Unmess.Domain.Usuarios;

namespace Unmess.Api.Authentication;

public static class AccessFilters
{
    public static TBuilder RequireCompany<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (context, next) =>
        {
            context.HttpContext.RequestServices.GetRequiredService<IUsuarioAtual>().EmpresaIdObrigatoria();
            return await next(context);
        });

    public static TBuilder RequirePermission<TBuilder>(this TBuilder builder, string permission) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (context, next) =>
        {
            var services = context.HttpContext.RequestServices;
            var usuario = services.GetRequiredService<IUsuarioAtual>().Exigir();
            if (!await services.GetRequiredService<ResolvedorDePermissoes>().PossuiAsync(usuario.Id, permission, context.HttpContext.RequestAborted))
            {
                throw AppException.Forbidden();
            }
            return await next(context);
        });

    public static TBuilder RequireSuper<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (context, next) =>
        {
            if (context.HttpContext.RequestServices.GetRequiredService<IUsuarioAtual>().Exigir().Perfil != Perfil.Super)
            {
                throw AppException.Forbidden();
            }
            return await next(context);
        });

    public static TBuilder RequireAdmin<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (context, next) =>
        {
            if (context.HttpContext.RequestServices.GetRequiredService<IUsuarioAtual>().Exigir().Perfil == Perfil.Usuario)
            {
                throw AppException.Forbidden();
            }
            return await next(context);
        });

    public static TBuilder RequireCompanyPermission<TBuilder>(this TBuilder builder, string permission) where TBuilder : IEndpointConventionBuilder =>
        builder.RequireCompany().RequirePermission(permission);
}
