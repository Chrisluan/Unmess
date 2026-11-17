using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Contatos;
using Unmess.Application.Usuarios;
using Unmess.Domain.Clientes;

namespace Unmess.Application.Clientes;

public sealed record ResponsavelResumido(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome);

public sealed record ClienteResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("tradeName")] string? NomeFantasia,
    [property: JsonPropertyName("personType")] string TipoDePessoa,
    [property: JsonPropertyName("document")] string? Documento,
    [property: JsonPropertyName("stateRegistration")] string? InscricaoEstadual,
    [property: JsonPropertyName("email")] string? Email,
    [property: JsonPropertyName("phone")] string? Telefone,
    [property: JsonPropertyName("whatsapp")] string? Whatsapp,
    [property: JsonPropertyName("zipCode")] string? Cep,
    [property: JsonPropertyName("street")] string? Logradouro,
    [property: JsonPropertyName("addressNumber")] string? Numero,
    [property: JsonPropertyName("complement")] string? Complemento,
    [property: JsonPropertyName("neighborhood")] string? Bairro,
    [property: JsonPropertyName("city")] string? Cidade,
    [property: JsonPropertyName("state")] string? Estado,
    [property: JsonPropertyName("segment")] string? Segmento,
    [property: JsonPropertyName("origin")] string? Origem,
    [property: JsonPropertyName("status")] string Situacao,
    [property: JsonPropertyName("notes")] string? Observacoes,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm,
    [property: JsonPropertyName("contactId")] int? ContatoId,
    [property: JsonPropertyName("responsibleUserId")] int? ResponsavelId,
    [property: JsonPropertyName("companyId")] int EmpresaId,
    [property: JsonPropertyName("responsibleUser")] ResponsavelResumido? Responsavel)
{
    [JsonPropertyName("contact")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public object? Contato { get; init; }

    public static ClienteResposta De(Cliente cliente, Func<Cliente, object?>? contato = null) => new(
        cliente.Id, cliente.Nome, cliente.NomeFantasia, cliente.TipoDePessoa, cliente.Documento, cliente.InscricaoEstadual,
        cliente.Email, cliente.Telefone, cliente.Whatsapp, cliente.Cep, cliente.Logradouro, cliente.Numero, cliente.Complemento,
        cliente.Bairro, cliente.Cidade, cliente.Estado, cliente.Segmento, cliente.Origem, cliente.Situacao, cliente.Observacoes,
        cliente.CriadoEm, cliente.AtualizadoEm, cliente.ContatoId, cliente.ResponsavelId, cliente.EmpresaId,
        cliente.Responsavel is { } responsavel ? new ResponsavelResumido(responsavel.Id, responsavel.Nome) : null)
    {
        Contato = contato?.Invoke(cliente)
    };
}

public sealed record ListaDeClientes(
    [property: JsonPropertyName("customers")] IReadOnlyList<ClienteResposta> Clientes,
    [property: JsonPropertyName("count")] int Total,
    [property: JsonPropertyName("hasMore")] bool TemMais);

public sealed record DadosDoCliente
{
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("tradeName")] public string? NomeFantasia { get; init; }
    [JsonPropertyName("personType")] public string? TipoDePessoa { get; init; }
    [JsonPropertyName("document")] public string? Documento { get; init; }
    [JsonPropertyName("stateRegistration")] public string? InscricaoEstadual { get; init; }
    [JsonPropertyName("email")] public string? Email { get; init; }
    [JsonPropertyName("phone")] public string? Telefone { get; init; }
    [JsonPropertyName("whatsapp")] public string? Whatsapp { get; init; }
    [JsonPropertyName("zipCode")] public string? Cep { get; init; }
    [JsonPropertyName("street")] public string? Logradouro { get; init; }
    [JsonPropertyName("addressNumber")] public string? Numero { get; init; }
    [JsonPropertyName("complement")] public string? Complemento { get; init; }
    [JsonPropertyName("neighborhood")] public string? Bairro { get; init; }
    [JsonPropertyName("city")] public string? Cidade { get; init; }
    [JsonPropertyName("state")] public string? Estado { get; init; }
    [JsonPropertyName("segment")] public string? Segmento { get; init; }
    [JsonPropertyName("origin")] public string? Origem { get; init; }
    [JsonPropertyName("status")] public string? Situacao { get; init; }
    [JsonPropertyName("notes")] public string? Observacoes { get; init; }
    [JsonPropertyName("contactId")] public int? ContatoId { get; init; }
    [JsonPropertyName("responsibleUserId")] public int? ResponsavelId { get; init; }
}

public sealed class ClienteService(IUnmessDbContext db, IUsuarioAtual usuarioAtual, IRealtimePublisher realtime)
{
    public const string ErroNaoEncontrado = "ERR_NO_CUSTOMER_FOUND";
    public const string ErroDuplicado = "ERR_DUPLICATED_CUSTOMER";
    private static readonly string[] TiposDePessoa = ["PF", "PJ"];
    private static readonly string[] Situacoes = ["lead", "active", "inactive"];

    public async Task<ListaDeClientes> ListarAsync(string? busca, string? pagina, string? situacao, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var termo = (busca ?? string.Empty).Trim();
        var minusculo = $"%{termo.ToLowerInvariant()}%";
        var literal = $"%{termo}%";
        var consulta = db.Clientes.AsNoTracking().Where(cliente => cliente.EmpresaId == empresaId &&
            (EF.Functions.Like(cliente.Nome.ToLower(), minusculo) ||
             EF.Functions.Like(cliente.NomeFantasia!.ToLower(), minusculo) ||
             EF.Functions.Like(cliente.Documento, literal) ||
             EF.Functions.Like(cliente.Telefone, literal) ||
             EF.Functions.Like(cliente.Whatsapp, literal)));
        if (!string.IsNullOrEmpty(situacao))
        {
            consulta = consulta.Where(cliente => cliente.Situacao == situacao);
        }

        var total = await consulta.CountAsync(cancellationToken);
        var deslocamento = Paging.Offset(pagina);
        var clientes = await consulta.Include(cliente => cliente.Contato).Include(cliente => cliente.Responsavel)
            .OrderBy(cliente => cliente.Nome).Skip(deslocamento).Take(Paging.PageSize).ToListAsync(cancellationToken);

        var itens = clientes.Select(cliente => ClienteResposta.De(cliente, item =>
            item.Contato is { } contato ? new ContatoResumido(contato.Id, contato.Nome, contato.Numero, contato.FotoDePerfil) : null)).ToList();
        return new ListaDeClientes(itens, total, total > deslocamento + itens.Count);
    }

    public async Task<ClienteResposta> MostrarAsync(int id, CancellationToken cancellationToken) =>
        Completo(await CarregarAsync(id, usuarioAtual.EmpresaIdObrigatoria(), cancellationToken));

    public async Task<ClienteResposta?> PorContatoAsync(int contatoId, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var cliente = await db.Clientes.AsNoTracking().Include(item => item.Responsavel)
            .FirstOrDefaultAsync(item => item.ContatoId == contatoId && item.EmpresaId == empresaId, cancellationToken);
        return cliente is null ? null : ClienteResposta.De(cliente);
    }

    public async Task<ClienteResposta> CriarAsync(DadosDoCliente dados, CancellationToken cancellationToken)
    {
        Validation.Required(dados.Nome, "name");
        Validar(dados);
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        if (!string.IsNullOrEmpty(dados.Documento) &&
            await db.Clientes.AnyAsync(cliente => cliente.Documento == dados.Documento && cliente.EmpresaId == empresaId, cancellationToken))
        {
            throw new AppException(ErroDuplicado);
        }

        var cliente = new Cliente { EmpresaId = empresaId };
        Aplicar(cliente, dados);
        db.Clientes.Add(cliente);
        await db.SaveChangesAsync(cancellationToken);

        var resposta = Completo(await CarregarAsync(cliente.Id, empresaId, cancellationToken));
        await realtime.ToCompanyAsync(empresaId, "customer", new { action = "create", customer = resposta }, cancellationToken);
        return resposta;
    }

    public async Task<ClienteResposta> AtualizarAsync(int id, DadosDoCliente dados, CancellationToken cancellationToken)
    {
        Validar(dados);
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var cliente = await db.Clientes.FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
                      ?? throw AppException.NotFound(ErroNaoEncontrado);
        if (!string.IsNullOrEmpty(dados.Documento) && dados.Documento != cliente.Documento &&
            await db.Clientes.AnyAsync(outro => outro.Documento == dados.Documento && outro.EmpresaId == empresaId && outro.Id != id, cancellationToken))
        {
            throw new AppException(ErroDuplicado);
        }

        Aplicar(cliente, dados);
        await db.SaveChangesAsync(cancellationToken);

        var resposta = Completo(await CarregarAsync(id, empresaId, cancellationToken));
        await realtime.ToCompanyAsync(empresaId, "customer", new { action = "update", customer = resposta }, cancellationToken);
        return resposta;
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var cliente = await db.Clientes.FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
                      ?? throw AppException.NotFound(ErroNaoEncontrado);
        db.Clientes.Remove(cliente);
        await db.SaveChangesAsync(cancellationToken);
        await realtime.ToCompanyAsync(empresaId, "customer", new { action = "delete", customerId = id.ToString(CultureInfo.InvariantCulture) }, cancellationToken);
    }

    private static ClienteResposta Completo(Cliente cliente) =>
        ClienteResposta.De(cliente, item => item.Contato is { } contato ? ContatoResposta.De(contato) : null);

    private async Task<Cliente> CarregarAsync(int id, int empresaId, CancellationToken cancellationToken) =>
        await db.Clientes.AsNoTracking().Include(item => item.Contato).Include(item => item.Responsavel)
            .FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
        ?? throw AppException.NotFound(ErroNaoEncontrado);

    private static void Validar(DadosDoCliente dados)
    {
        if (dados.TipoDePessoa is not null && !TiposDePessoa.Contains(dados.TipoDePessoa))
        {
            throw new AppException("personType must be one of the following values: PF, PJ");
        }
        Validation.Email(dados.Email);
        if (dados.Situacao is not null && !Situacoes.Contains(dados.Situacao))
        {
            throw new AppException("status must be one of the following values: lead, active, inactive");
        }
    }

    private static void Aplicar(Cliente cliente, DadosDoCliente dados)
    {
        if (dados.Nome is not null) cliente.Nome = dados.Nome;
        if (dados.NomeFantasia is not null) cliente.NomeFantasia = dados.NomeFantasia;
        if (dados.TipoDePessoa is not null) cliente.TipoDePessoa = dados.TipoDePessoa;
        if (dados.Documento is not null) cliente.Documento = dados.Documento;
        if (dados.InscricaoEstadual is not null) cliente.InscricaoEstadual = dados.InscricaoEstadual;
        if (dados.Email is not null) cliente.Email = dados.Email;
        if (dados.Telefone is not null) cliente.Telefone = dados.Telefone;
        if (dados.Whatsapp is not null) cliente.Whatsapp = dados.Whatsapp;
        if (dados.Cep is not null) cliente.Cep = dados.Cep;
        if (dados.Logradouro is not null) cliente.Logradouro = dados.Logradouro;
        if (dados.Numero is not null) cliente.Numero = dados.Numero;
        if (dados.Complemento is not null) cliente.Complemento = dados.Complemento;
        if (dados.Bairro is not null) cliente.Bairro = dados.Bairro;
        if (dados.Cidade is not null) cliente.Cidade = dados.Cidade;
        if (dados.Estado is not null) cliente.Estado = dados.Estado;
        if (dados.Segmento is not null) cliente.Segmento = dados.Segmento;
        if (dados.Origem is not null) cliente.Origem = dados.Origem;
        if (dados.Situacao is not null) cliente.Situacao = dados.Situacao;
        if (dados.Observacoes is not null) cliente.Observacoes = dados.Observacoes;
        if (dados.ContatoId is not null) cliente.ContatoId = dados.ContatoId;
        if (dados.ResponsavelId is not null) cliente.ResponsavelId = dados.ResponsavelId;
    }
}
