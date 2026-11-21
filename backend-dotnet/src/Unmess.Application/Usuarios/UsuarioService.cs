using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Domain.Usuarios;

namespace Unmess.Application.Usuarios;

public sealed class UsuarioService(
    IUnmessDbContext db,
    IUsuarioAtual usuarioAtual,
    IPasswordHasher passwordHasher,
    IRealtimePublisher realtime,
    TimeProvider timeProvider)
{
    public const string ErroUsuarioNaoEncontrado = "ERR_NO_USER_FOUND";
    public const string ErroEmailDuplicado = "An user with this email already exists.";

    public async Task<ListaDeUsuarios> ListarAsync(string? busca, string? pagina, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var padrao = $"%{(busca ?? string.Empty).ToLowerInvariant()}%";
        var consulta = db.Usuarios.AsNoTracking()
            .Where(usuario => usuario.EmpresaId == empresaId)
            .Where(usuario => EF.Functions.Like(usuario.Nome.ToLower(), padrao) || EF.Functions.Like(usuario.Email, padrao));

        var total = await consulta.CountAsync(cancellationToken);
        var deslocamento = Paging.Offset(pagina);
        var usuarios = await consulta
            .Include(usuario => usuario.Filas)
            .Include(usuario => usuario.ConexaoWhatsapp)
            .OrderByDescending(usuario => usuario.CriadoEm)
            .Skip(deslocamento)
            .Take(Paging.PageSize)
            .ToListAsync(cancellationToken);

        var itens = usuarios.Select(usuario => new UsuarioDaLista(
            usuario.Nome,
            usuario.Id,
            usuario.Email,
            usuario.Perfil,
            usuario.CriadoEm,
            usuario.MaximoDeTicketsSimultaneos,
            usuario.Online,
            usuario.VistoPorUltimoEm,
            UsuarioMapeamento.FilasResumidas(usuario),
            UsuarioMapeamento.ConexaoResumida(usuario))).ToList();

        return new ListaDeUsuarios(itens, total, total > deslocamento + itens.Count);
    }

    public async Task<UsuarioDetalhado> MostrarAsync(int id, CancellationToken cancellationToken)
    {
        var atual = usuarioAtual.Exigir();
        var usuario = await CarregarAsync(id, cancellationToken);
        if (atual.Perfil != Perfil.Super && usuario.EmpresaId != atual.EmpresaId)
        {
            throw AppException.Forbidden();
        }

        return UsuarioMapeamento.Detalhar(usuario);
    }

    public async Task<UsuarioSerializado> CriarAsync(DadosDoUsuario dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();

        Validation.Required(dados.Nome, "name");
        Validation.MinLength(dados.Nome, "name", 2);
        Validation.Required(dados.Email, "email");
        Validation.Email(dados.Email);
        if (await db.Usuarios.AnyAsync(usuario => usuario.Email == dados.Email && usuario.EmpresaId == empresaId, cancellationToken))
        {
            throw new AppException(ErroEmailDuplicado);
        }
        Validation.Required(dados.Senha, "password");
        Validation.MinLength(dados.Senha, "password", 5);

        var usuario = new Usuario
        {
            Nome = dados.Nome!,
            Email = dados.Email!,
            HashDaSenha = passwordHasher.Hash(dados.Senha!),
            Perfil = string.IsNullOrEmpty(dados.Perfil) ? PerfilConversor.Admin : dados.Perfil,
            EmpresaId = empresaId,
            GrupoDePermissaoId = dados.GrupoDePermissaoId is > 0 ? dados.GrupoDePermissaoId : null,
            MaximoDeTicketsSimultaneos = dados.MaximoDeTicketsSimultaneos ?? 0,
            ConexaoWhatsappId = dados.ConexaoWhatsappId is > 0 ? dados.ConexaoWhatsappId : null,
            Filas = await FilasAsync(dados.FilaIds, cancellationToken)
        };

        db.Usuarios.Add(usuario);
        await db.SaveChangesAsync(cancellationToken);

        var serializado = UsuarioMapeamento.Serializar(await CarregarAsync(usuario.Id, cancellationToken));
        await realtime.ToCompanyAsync(empresaId, "user", new { action = "create", user = serializado }, cancellationToken);
        return serializado;
    }

    public async Task<UsuarioSerializado> AtualizarAsync(int id, DadosDoUsuario dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var usuario = await db.Usuarios
            .Include(item => item.Filas)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw AppException.NotFound(ErroUsuarioNaoEncontrado);

        if (usuario.EmpresaId != empresaId)
        {
            throw AppException.Forbidden();
        }

        Validation.MinLength(dados.Nome, "name", 2);
        Validation.Email(dados.Email);

        if (dados.Email is not null)
        {
            usuario.Email = dados.Email;
        }
        if (!string.IsNullOrEmpty(dados.Senha))
        {
            usuario.HashDaSenha = passwordHasher.Hash(dados.Senha);
        }
        if (dados.Perfil is not null)
        {
            usuario.Perfil = dados.Perfil;
        }
        if (dados.Nome is not null)
        {
            usuario.Nome = dados.Nome;
        }

        usuario.ConexaoWhatsappId = dados.ConexaoWhatsappId is > 0 ? dados.ConexaoWhatsappId : null;
        if (dados.GrupoDePermissaoId is not null)
        {
            usuario.GrupoDePermissaoId = dados.GrupoDePermissaoId;
        }
        if (dados.MaximoDeTicketsSimultaneos is not null)
        {
            usuario.MaximoDeTicketsSimultaneos = dados.MaximoDeTicketsSimultaneos.Value;
        }
        if (dados.PermissoesPersonalizadas is not null)
        {
            usuario.PermissoesPersonalizadas = JsonSerializer.Serialize(new
            {
                add = dados.PermissoesPersonalizadas.Adicionar,
                remove = dados.PermissoesPersonalizadas.Remover
            });
        }

        usuario.Filas.Clear();
        usuario.Filas.AddRange(await FilasAsync(dados.FilaIds, cancellationToken));
        await db.SaveChangesAsync(cancellationToken);

        var serializado = UsuarioMapeamento.Serializar(await CarregarAsync(usuario.Id, cancellationToken));
        await realtime.ToCompanyAsync(empresaId, "user", new { action = "update", user = serializado }, cancellationToken);
        return serializado;
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var usuario = await db.Usuarios.FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
                      ?? throw AppException.NotFound(ErroUsuarioNaoEncontrado);

        var ticketsAbertos = await db.Tickets
            .Where(ticket => ticket.UsuarioId == id && ticket.Situacao == "open")
            .ToListAsync(cancellationToken);
        var agora = timeProvider.GetUtcNow();
        foreach (var ticket in ticketsAbertos)
        {
            ticket.Situacao = "pending";
            ticket.AtualizadoEm = agora;
        }

        db.Usuarios.Remove(usuario);
        await db.SaveChangesAsync(cancellationToken);
        await realtime.ToCompanyAsync(empresaId, "user", new { action = "delete", userId = id.ToString(System.Globalization.CultureInfo.InvariantCulture) }, cancellationToken);
    }

    public async Task<Usuario> CarregarAsync(int id, CancellationToken cancellationToken) =>
        await db.Usuarios.AsNoTracking()
            .Include(usuario => usuario.Filas)
            .Include(usuario => usuario.ConexaoWhatsapp)
            .FirstOrDefaultAsync(usuario => usuario.Id == id, cancellationToken)
        ?? throw AppException.NotFound(ErroUsuarioNaoEncontrado);

    private async Task<List<Domain.Filas.Fila>> FilasAsync(List<int>? ids, CancellationToken cancellationToken)
    {
        if (ids is null || ids.Count == 0)
        {
            return [];
        }

        return await db.Filas.Where(fila => ids.Contains(fila.Id)).ToListAsync(cancellationToken);
    }
}
