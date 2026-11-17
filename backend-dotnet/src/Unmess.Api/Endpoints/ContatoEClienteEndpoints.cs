using Unmess.Api.Authentication;
using Unmess.Application.Clientes;
using Unmess.Application.Common;
using Unmess.Application.Contatos;
using Unmess.Application.Figurinhas;
using Unmess.Application.Produtos;

namespace Unmess.Api.Endpoints;

public static class ContatoEClienteEndpoints
{
    public static IEndpointRouteBuilder MapContatoEClienteEndpoints(this IEndpointRouteBuilder endpoints)
    {
        MapContatos(endpoints);
        MapClientes(endpoints.MapGroup("/customers").RequireAuthorization());
        MapProdutos(endpoints.MapGroup("/products").RequireAuthorization());
        MapFigurinhas(endpoints.MapGroup("/stickers").RequireAuthorization());
        return endpoints;
    }

    private static void MapContatos(IEndpointRouteBuilder endpoints)
    {
        var contatos = endpoints.MapGroup("/contacts").RequireAuthorization();

        contatos.MapPost("/import", async (ContatoService servico, CancellationToken cancellationToken) =>
            {
                await servico.ImportarDoAparelhoAsync(cancellationToken);
                return Results.Ok(new { message = "contacts imported" });
            })
            .RequireCompanyPermission("contacts:import");

        contatos.MapGet("/", async (string? searchParam, string? pageNumber, ContatoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(searchParam, pageNumber, cancellationToken)))
            .RequireCompanyPermission("contacts:view");

        contatos.MapGet("/{contactId:int}/tickets", async (int contactId, ContatoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.TicketsAsync(contactId, cancellationToken)))
            .RequireCompanyPermission("tickets:view");

        contatos.MapGet("/{contactId:int}", async (int contactId, ContatoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.MostrarAsync(contactId, cancellationToken)))
            .RequireCompanyPermission("contacts:view");

        contatos.MapPost("/", async (DadosDoContato dados, ContatoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarAsync(dados, cancellationToken)))
            .RequireCompanyPermission("contacts:create");

        endpoints.MapPost("/contact", async (DadosDoContato dados, ContatoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ObterOuCriarAsync(dados, cancellationToken)))
            .RequireAuthorization()
            .RequireCompanyPermission("contacts:view");

        contatos.MapPut("/{contactId:int}/known", async (int contactId, DadosDeConhecido dados, ContatoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.MarcarConhecidoAsync(contactId, dados, cancellationToken)))
            .RequireCompanyPermission("contacts:edit");

        contatos.MapPut("/{contactId:int}", async (int contactId, DadosDoContato dados, ContatoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtualizarAsync(contactId, dados, cancellationToken)))
            .RequireCompanyPermission("contacts:edit");

        contatos.MapDelete("/{contactId:int}", async (int contactId, ContatoService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverAsync(contactId, cancellationToken);
                return Results.Ok(new { message = "Contact deleted" });
            })
            .RequireCompanyPermission("contacts:delete");
    }

    private static void MapClientes(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/", async (string? searchParam, string? pageNumber, string? status, ClienteService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(searchParam, pageNumber, status, cancellationToken)))
            .RequireCompanyPermission("clients:view");

        grupo.MapGet("/by-contact/{contactId:int}", async (int contactId, ClienteService servico, CancellationToken cancellationToken) =>
                await servico.PorContatoAsync(contactId, cancellationToken) is { } cliente
                    ? Results.Ok(cliente)
                    : Results.Text("null", "application/json"))
            .RequireCompanyPermission("tickets:view");

        grupo.MapGet("/{customerId:int}", async (int customerId, ClienteService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.MostrarAsync(customerId, cancellationToken)))
            .RequireCompanyPermission("clients:view");

        grupo.MapPost("/", async (DadosDoCliente dados, ClienteService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarAsync(dados, cancellationToken)))
            .RequireCompanyPermission("clients:create");

        grupo.MapPut("/{customerId:int}", async (int customerId, DadosDoCliente dados, ClienteService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtualizarAsync(customerId, dados, cancellationToken)))
            .RequireCompanyPermission("clients:edit");

        grupo.MapDelete("/{customerId:int}", async (int customerId, ClienteService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverAsync(customerId, cancellationToken);
                return Results.Ok(new { message = "Customer deleted" });
            })
            .RequireCompanyPermission("clients:delete");
    }

    private static void MapProdutos(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/", async (string? searchParam, string? category, string? includeInactive, ProdutoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(searchParam, category, includeInactive, cancellationToken)))
            .RequireCompanyPermission("crm:view");

        grupo.MapGet("/categories", async (ProdutoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CategoriasAsync(cancellationToken)))
            .RequireCompanyPermission("crm:view");

        grupo.MapPost("/", async (DadosDoProduto dados, ProdutoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.CriarAsync(dados, cancellationToken)))
            .RequireCompanyPermission("products:manage");

        grupo.MapPut("/{productId:int}", async (int productId, DadosDoProduto dados, ProdutoService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.AtualizarAsync(productId, dados, cancellationToken)))
            .RequireCompanyPermission("products:manage");

        grupo.MapDelete("/{productId:int}", async (int productId, ProdutoService servico, CancellationToken cancellationToken) =>
            {
                await servico.DesativarAsync(productId, cancellationToken);
                return Results.Ok(new { message = "Product deactivated" });
            })
            .RequireCompanyPermission("products:manage");
    }

    private static void MapFigurinhas(RouteGroupBuilder grupo)
    {
        grupo.MapGet("/", async (string? searchParam, FigurinhaService servico, CancellationToken cancellationToken) =>
                Results.Ok(await servico.ListarAsync(searchParam, cancellationToken)))
            .RequireCompanyPermission("stickers:view");

        grupo.MapPost("/", async (HttpRequest request, FigurinhaService servico, CancellationToken cancellationToken) =>
            {
                var formulario = request.HasFormContentType ? await request.ReadFormAsync(cancellationToken) : null;
                var arquivo = formulario?.Files.GetFile("file");
                var enviado = arquivo is null ? null : new ArquivoEnviado(arquivo.FileName, arquivo.ContentType, arquivo.Length, arquivo.OpenReadStream);
                return Results.Ok(await servico.CriarAsync(formulario?["name"].FirstOrDefault(), enviado, cancellationToken));
            })
            .RequireCompanyPermission("stickers:create")
            .DisableAntiforgery();

        grupo.MapDelete("/{stickerId:int}", async (int stickerId, FigurinhaService servico, CancellationToken cancellationToken) =>
            {
                await servico.RemoverAsync(stickerId, cancellationToken);
                return Results.Ok(new { message = "Sticker deleted" });
            })
            .RequireCompanyPermission("stickers:delete");
    }
}
