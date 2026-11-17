using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Domain.Produtos;

namespace Unmess.Application.Produtos;

public sealed record ProdutoResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("code")] string? Codigo,
    [property: JsonPropertyName("description")] string? Descricao,
    [property: JsonPropertyName("unit")] string Unidade,
    [property: JsonPropertyName("price")] decimal Preco,
    [property: JsonPropertyName("cost")] decimal Custo,
    [property: JsonPropertyName("pricingMode")] string ModoDePreco,
    [property: JsonPropertyName("minMeasure")] decimal MedidaMinima,
    [property: JsonPropertyName("category")] string? Categoria,
    [property: JsonPropertyName("active")] bool Ativo,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm,
    [property: JsonPropertyName("companyId")] int EmpresaId)
{
    public static ProdutoResposta De(Produto produto) => new(
        produto.Id, produto.Nome, produto.Codigo, produto.Descricao, produto.Unidade, produto.Preco, produto.Custo,
        produto.ModoDePreco, produto.MedidaMinima, produto.Categoria, produto.Ativo, produto.CriadoEm, produto.AtualizadoEm, produto.EmpresaId);
}

public sealed record DadosDoProduto
{
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("code")] public string? Codigo { get; init; }
    [JsonPropertyName("description")] public string? Descricao { get; init; }
    [JsonPropertyName("unit")] public string? Unidade { get; init; }
    [JsonPropertyName("price")] public decimal? Preco { get; init; }
    [JsonPropertyName("cost")] public decimal? Custo { get; init; }
    [JsonPropertyName("pricingMode")] public string? ModoDePreco { get; init; }
    [JsonPropertyName("minMeasure")] public decimal? MedidaMinima { get; init; }
    [JsonPropertyName("category")] public string? Categoria { get; init; }
    [JsonPropertyName("active")] public bool? Ativo { get; init; }
}

public sealed class ProdutoService(IUnmessDbContext db, IUsuarioAtual usuarioAtual)
{
    public const string ErroNaoEncontrado = "ERR_NO_PRODUCT_FOUND";

    public async Task<object> ListarAsync(string? busca, string? categoria, string? incluirInativos, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var consulta = db.Produtos.AsNoTracking().Where(produto => produto.EmpresaId == empresaId);
        if (incluirInativos != "true")
        {
            consulta = consulta.Where(produto => produto.Ativo);
        }
        if (!string.IsNullOrEmpty(categoria))
        {
            consulta = consulta.Where(produto => produto.Categoria == categoria);
        }

        var termo = busca?.Trim();
        if (!string.IsNullOrEmpty(termo))
        {
            var padrao = $"%{termo}%";
            consulta = consulta.Where(produto => EF.Functions.Like(produto.Nome, padrao) || EF.Functions.Like(produto.Codigo, padrao));
        }

        var produtos = await consulta.OrderBy(produto => produto.Nome).Take(string.IsNullOrEmpty(termo) ? 300 : 30).ToListAsync(cancellationToken);
        return new { products = produtos.Select(ProdutoResposta.De).ToList() };
    }

    public async Task<object> CategoriasAsync(CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var categorias = await db.Produtos.AsNoTracking()
            .Where(produto => produto.EmpresaId == empresaId && produto.Ativo && produto.Categoria != null && produto.Categoria != "")
            .Select(produto => produto.Categoria!)
            .Distinct()
            .OrderBy(categoria => categoria)
            .ToListAsync(cancellationToken);
        return new { categories = categorias };
    }

    public async Task<ProdutoResposta> CriarAsync(DadosDoProduto dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var produto = new Produto { EmpresaId = empresaId };
        Aplicar(produto, dados);
        Validar(produto);
        db.Produtos.Add(produto);
        await db.SaveChangesAsync(cancellationToken);
        return ProdutoResposta.De(produto);
    }

    public async Task<ProdutoResposta> AtualizarAsync(int id, DadosDoProduto dados, CancellationToken cancellationToken)
    {
        var produto = await BuscarAsync(id, cancellationToken);
        Aplicar(produto, dados);
        Validar(produto);
        await db.SaveChangesAsync(cancellationToken);
        return ProdutoResposta.De(produto);
    }

    public async Task DesativarAsync(int id, CancellationToken cancellationToken)
    {
        var produto = await BuscarAsync(id, cancellationToken);
        produto.Ativo = false;
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<Produto> BuscarAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        return await db.Produtos.FirstOrDefaultAsync(produto => produto.Id == id && produto.EmpresaId == empresaId, cancellationToken)
               ?? throw AppException.NotFound(ErroNaoEncontrado);
    }

    private static void Aplicar(Produto produto, DadosDoProduto dados)
    {
        if (dados.Nome is not null) produto.Nome = dados.Nome;
        if (dados.Codigo is not null) produto.Codigo = dados.Codigo;
        if (dados.Descricao is not null) produto.Descricao = dados.Descricao;
        if (dados.Unidade is not null) produto.Unidade = dados.Unidade;
        if (dados.Preco is not null) produto.Preco = dados.Preco.Value;
        if (dados.Custo is not null) produto.Custo = dados.Custo.Value;
        if (dados.ModoDePreco is not null) produto.ModoDePreco = dados.ModoDePreco;
        if (dados.MedidaMinima is not null) produto.MedidaMinima = dados.MedidaMinima.Value;
        if (dados.Categoria is not null) produto.Categoria = dados.Categoria;
        if (dados.Ativo is not null) produto.Ativo = dados.Ativo.Value;
    }

    private static void Validar(Produto produto)
    {
        Validation.Required(produto.Nome, "name");
        if (produto.Nome.Length > 255) throw new AppException("name must be at most 255 characters");
        if (produto.Unidade.Length > 12) throw new AppException("unit must be at most 12 characters");
        if (produto.Preco < 0) throw new AppException("price must be greater than or equal to 0");
        if (produto.Custo < 0) throw new AppException("cost must be greater than or equal to 0");
    }
}
