using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Domain.Crm;
using Unmess.Domain.Empresas;
using Unmess.Domain.Usuarios;

namespace Unmess.Application.Empresas;

public sealed record EmpresaResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("document")] string? Documento,
    [property: JsonPropertyName("email")] string? Email,
    [property: JsonPropertyName("phone")] string? Telefone,
    [property: JsonPropertyName("plan")] string Plano,
    [property: JsonPropertyName("status")] string Situacao,
    [property: JsonPropertyName("dueDate")] DateTimeOffset? Vencimento,
    [property: JsonPropertyName("logo")] string? Logo,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm)
{
    public static EmpresaResposta De(Empresa empresa) => new(
        empresa.Id, empresa.Nome, empresa.Documento, empresa.Email, empresa.Telefone, empresa.Plano,
        empresa.Situacao, empresa.Vencimento, empresa.Logo, empresa.CriadoEm, empresa.AtualizadoEm);
}

public sealed record ListaDeEmpresas(
    [property: JsonPropertyName("companies")] IReadOnlyList<EmpresaResposta> Empresas,
    [property: JsonPropertyName("count")] int Total,
    [property: JsonPropertyName("hasMore")] bool TemMais);

public sealed record AdministradorCriado(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("profile")] string Perfil,
    [property: JsonPropertyName("companyId")] int? EmpresaId);

public sealed record EmpresaCriada(
    [property: JsonPropertyName("company")] EmpresaResposta Empresa,
    [property: JsonPropertyName("adminUser")] AdministradorCriado Administrador);

public sealed record DadosDaEmpresa
{
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("document")] public string? Documento { get; init; }
    [JsonPropertyName("email")] public string? Email { get; init; }
    [JsonPropertyName("phone")] public string? Telefone { get; init; }
    [JsonPropertyName("plan")] public string? Plano { get; init; }
    [JsonPropertyName("status")] public string? Situacao { get; init; }
    [JsonPropertyName("dueDate")] public DateTimeOffset? Vencimento { get; init; }
    [JsonPropertyName("adminName")] public string? NomeDoAdministrador { get; init; }
    [JsonPropertyName("adminEmail")] public string? EmailDoAdministrador { get; init; }
    [JsonPropertyName("adminPassword")] public string? SenhaDoAdministrador { get; init; }
}

public sealed record IdentidadeVisual(
    [property: JsonPropertyName("name")] string? Nome,
    [property: JsonPropertyName("logo")] string? Logo);

public sealed class EmpresaService(
    IUnmessDbContext db,
    IUsuarioAtual usuarioAtual,
    IPasswordHasher passwordHasher,
    IFileStorage arquivos,
    IRealtimePublisher realtime)
{
    public const string ErroEmpresaNaoEncontrada = "ERR_NO_COMPANY_FOUND";
    public const string ErroDocumentoDuplicado = "ERR_DUPLICATED_COMPANY_DOCUMENT";
    public const string ErroEmpresaComUsuarios = "ERR_COMPANY_HAS_USERS";
    public const string ErroNomeObrigatorio = "ERR_COMPANY_NAME_REQUIRED";

    public async Task<ListaDeEmpresas> ListarAsync(string? busca, string? pagina, CancellationToken cancellationToken)
    {
        var padrao = $"%{(busca ?? string.Empty).ToLowerInvariant().Trim()}%";
        var consulta = db.Empresas.AsNoTracking().Where(empresa =>
            EF.Functions.Like(empresa.Nome.ToLower(), padrao) ||
            EF.Functions.Like(empresa.Email, padrao) ||
            EF.Functions.Like(empresa.Documento, padrao));

        var total = await consulta.CountAsync(cancellationToken);
        var deslocamento = Paging.Offset(pagina);
        var empresas = await consulta.OrderBy(empresa => empresa.Nome).Skip(deslocamento).Take(Paging.PageSize).ToListAsync(cancellationToken);
        return new ListaDeEmpresas(empresas.Select(EmpresaResposta.De).ToList(), total, total > deslocamento + empresas.Count);
    }

    public async Task<EmpresaResposta> MostrarAsync(int id, CancellationToken cancellationToken) =>
        EmpresaResposta.De(await BuscarAsync(id, cancellationToken));

    public async Task<EmpresaCriada> CriarAsync(DadosDaEmpresa dados, CancellationToken cancellationToken)
    {
        Validation.Required(dados.Nome, "name");
        Validation.Required(dados.NomeDoAdministrador, "adminName");
        Validation.MinLength(dados.NomeDoAdministrador, "adminName", 2);
        Validation.Required(dados.EmailDoAdministrador, "adminEmail");
        Validation.Email(dados.EmailDoAdministrador, "adminEmail");
        Validation.Required(dados.SenhaDoAdministrador, "adminPassword");
        Validation.MinLength(dados.SenhaDoAdministrador, "adminPassword", 5);

        if (!string.IsNullOrEmpty(dados.Documento) &&
            await db.Empresas.AnyAsync(empresa => empresa.Documento == dados.Documento, cancellationToken))
        {
            throw new AppException(ErroDocumentoDuplicado);
        }

        await using var transacao = await db.Database.BeginTransactionAsync(cancellationToken);
        var empresa = new Empresa
        {
            Nome = dados.Nome!,
            Documento = dados.Documento,
            Email = dados.Email,
            Telefone = dados.Telefone,
            Plano = dados.Plano ?? "basic",
            Situacao = dados.Situacao ?? "active",
            Vencimento = dados.Vencimento
        };
        db.Empresas.Add(empresa);
        await db.SaveChangesAsync(cancellationToken);

        var administrador = new Usuario
        {
            Nome = dados.NomeDoAdministrador!,
            Email = dados.EmailDoAdministrador!,
            HashDaSenha = passwordHasher.Hash(dados.SenhaDoAdministrador!),
            Perfil = PerfilConversor.Admin,
            EmpresaId = empresa.Id
        };
        db.Usuarios.Add(administrador);
        CriarQuadrosPadrao(empresa.Id);
        await db.SaveChangesAsync(cancellationToken);
        await transacao.CommitAsync(cancellationToken);

        var resposta = EmpresaResposta.De(empresa);
        await realtime.ToAllAsync("company", new { action = "create", company = resposta }, cancellationToken);
        return new EmpresaCriada(resposta, new AdministradorCriado(administrador.Id, administrador.Nome, administrador.Email, administrador.Perfil, administrador.EmpresaId));
    }

    public async Task<EmpresaResposta> AtualizarAsync(int id, DadosDaEmpresa dados, CancellationToken cancellationToken)
    {
        var empresa = await BuscarAsync(id, cancellationToken);
        if (dados.Nome is not null) empresa.Nome = dados.Nome;
        if (dados.Documento is not null) empresa.Documento = dados.Documento;
        if (dados.Email is not null) empresa.Email = dados.Email;
        if (dados.Telefone is not null) empresa.Telefone = dados.Telefone;
        if (dados.Plano is not null) empresa.Plano = dados.Plano;
        if (dados.Situacao is not null) empresa.Situacao = dados.Situacao;
        if (dados.Vencimento is not null) empresa.Vencimento = dados.Vencimento;
        await db.SaveChangesAsync(cancellationToken);

        var resposta = EmpresaResposta.De(empresa);
        await realtime.ToAllAsync("company", new { action = "update", company = resposta }, cancellationToken);
        return resposta;
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresa = await BuscarAsync(id, cancellationToken);
        if (await db.Usuarios.AnyAsync(usuario => usuario.EmpresaId == id, cancellationToken))
        {
            throw new AppException(ErroEmpresaComUsuarios);
        }

        db.Empresas.Remove(empresa);
        await db.SaveChangesAsync(cancellationToken);
        await realtime.ToAllAsync("company", new { action = "delete", companyId = id.ToString(System.Globalization.CultureInfo.InvariantCulture) }, cancellationToken);
    }

    public async Task<IdentidadeVisual> IdentidadeVisualAsync(CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var empresa = await db.Empresas.AsNoTracking().FirstOrDefaultAsync(item => item.Id == empresaId, cancellationToken);
        return empresa is null ? new IdentidadeVisual(null, null) : new IdentidadeVisual(empresa.Nome, empresa.Logo);
    }

    public async Task<IdentidadeVisual> AtualizarIdentidadeVisualAsync(string? nome, ArquivoEnviado? logo, bool removerLogo, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var empresa = await BuscarAsync(empresaId, cancellationToken);

        if (nome is not null)
        {
            var limpo = nome.Trim();
            if (limpo.Length == 0)
            {
                throw new AppException(ErroNomeObrigatorio);
            }
            empresa.Nome = limpo;
        }

        var logoAtual = empresa.Logo;
        if (logo is not null)
        {
            empresa.Logo = await arquivos.SalvarAsync(logo, cancellationToken);
            arquivos.Remover(logoAtual);
        }
        else if (removerLogo)
        {
            empresa.Logo = null;
            arquivos.Remover(logoAtual);
        }

        await db.SaveChangesAsync(cancellationToken);
        var resposta = new IdentidadeVisual(empresa.Nome, empresa.Logo);
        await realtime.ToCompanyAsync(empresaId, "branding", new { action = "update", branding = resposta }, cancellationToken);
        return resposta;
    }

    private async Task<Empresa> BuscarAsync(int id, CancellationToken cancellationToken) =>
        await db.Empresas.FirstOrDefaultAsync(empresa => empresa.Id == id, cancellationToken)
        ?? throw AppException.NotFound(ErroEmpresaNaoEncontrada);

    private void CriarQuadrosPadrao(int empresaId)
    {
        foreach (var (modelo, indice) in QuadrosPadrao.Todos.Select((modelo, indice) => (modelo, indice)))
        {
            db.Quadros.Add(new Quadro
            {
                Nome = modelo.Nome,
                Cor = modelo.Cor,
                Ordem = indice,
                EmpresaId = empresaId,
                Etapas = modelo.Etapas.Select((etapa, posicao) => new EtapaDoFunil
                {
                    Nome = etapa.Nome,
                    Cor = etapa.Cor,
                    Tipo = etapa.Tipo,
                    EhInicial = etapa.Inicial,
                    EhFinal = etapa.Final,
                    Ordem = posicao,
                    EmpresaId = empresaId
                }).ToList()
            });
        }
    }
}
