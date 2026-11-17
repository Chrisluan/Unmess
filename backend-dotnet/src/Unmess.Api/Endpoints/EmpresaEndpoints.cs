using Unmess.Api.Authentication;
using Unmess.Application.Common;
using Unmess.Application.Empresas;

namespace Unmess.Api.Endpoints;

public static class EmpresaEndpoints
{
    public static IEndpointRouteBuilder MapEmpresaEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var identidade = endpoints.MapGroup("/company/branding").RequireAuthorization();

        identidade.MapGet("/", async (EmpresaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.IdentidadeVisualAsync(cancellationToken)))
            .RequireCompany();

        identidade.MapPut("/", async (HttpRequest request, EmpresaService servico, CancellationToken cancellationToken) =>
            {
                var formulario = request.HasFormContentType ? await request.ReadFormAsync(cancellationToken) : null;
                var logo = formulario?.Files.GetFile("logo");
                var arquivo = logo is null ? null : new ArquivoEnviado(logo.FileName, logo.ContentType, logo.Length, logo.OpenReadStream);
                var nome = formulario?["name"].FirstOrDefault();
                var remover = formulario?["removeLogo"].FirstOrDefault() == "true";
                return Results.Ok(await servico.AtualizarIdentidadeVisualAsync(nome, arquivo, remover, cancellationToken));
            })
            .RequireCompanyPermission("settings:edit")
            .DisableAntiforgery();

        var empresas = endpoints.MapGroup("/companies").RequireAuthorization().RequireSuper();

        empresas.MapGet("/", async (string? searchParam, string? pageNumber, EmpresaService servico, CancellationToken cancellationToken) =>
            Results.Ok(await servico.ListarAsync(searchParam, pageNumber, cancellationToken)));

        empresas.MapGet("/{companyId:int}", async (int companyId, EmpresaService servico, CancellationToken cancellationToken) =>
            Results.Ok(await servico.MostrarAsync(companyId, cancellationToken)));

        empresas.MapPost("/", async (DadosDaEmpresa dados, EmpresaService servico, CancellationToken cancellationToken) =>
            Results.Ok(await servico.CriarAsync(dados, cancellationToken)));

        empresas.MapPut("/{companyId:int}", async (int companyId, DadosDaEmpresa dados, EmpresaService servico, CancellationToken cancellationToken) =>
            Results.Ok(await servico.AtualizarAsync(companyId, dados, cancellationToken)));

        empresas.MapDelete("/{companyId:int}", async (int companyId, EmpresaService servico, CancellationToken cancellationToken) =>
        {
            await servico.RemoverAsync(companyId, cancellationToken);
            return Results.Ok(new { message = "Company deleted" });
        });

        return endpoints;
    }
}
