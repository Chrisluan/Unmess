using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Unmess.Application.Common;
using Unmess.Application.Conexoes;
using Unmess.Application.Usuarios;
using Unmess.Application.WhatsappGateway;
using Unmess.Domain.Contatos;

namespace Unmess.Application.Contatos;

public sealed record TicketDoContato(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("protocol")] string? Protocolo,
    [property: JsonPropertyName("status")] string Situacao,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("closedAt")] DateTimeOffset? EncerradoEm,
    [property: JsonPropertyName("lastMessage")] string? UltimaMensagem,
    [property: JsonPropertyName("userId")] int? UsuarioId,
    [property: JsonPropertyName("user")] object? Usuario,
    [property: JsonPropertyName("queue")] object? Fila,
    [property: JsonPropertyName("whatsapp")] object? Conexao,
    [property: JsonPropertyName("closingStatus")] object? SituacaoDeEncerramento);

public sealed class ContatoService(
    IUnmessDbContext db,
    IUsuarioAtual usuarioAtual,
    SeletorDeConexao seletorDeConexao,
    IWhatsappGateway gateway,
    IRealtimePublisher realtime,
    ILogger<ContatoService> logger)
{
    public const string ErroNaoEncontrado = "ERR_NO_CONTACT_FOUND";
    public const string ErroDuplicado = "ERR_DUPLICATED_CONTACT";
    public const string ErroContatoInvalido = "ERR_WAPP_INVALID_CONTACT";
    public const string ErroVerificacao = "ERR_WAPP_CHECK_CONTACT";
    public const string ErroValorConhecido = "ERR_INVALID_KNOWN_VALUE";
    public const string ErroFormatoDoNumero = "Invalid number format. Only numbers is allowed.";

    public async Task<ListaDeContatos> ListarAsync(string? busca, string? pagina, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var padrao = $"%{(busca ?? string.Empty).ToLowerInvariant().Trim()}%";
        var consulta = db.Contatos.AsNoTracking().Where(contato => contato.EmpresaId == empresaId &&
            (EF.Functions.Like(contato.Nome.ToLower(), padrao) || EF.Functions.Like(contato.Numero, padrao)));

        var total = await consulta.CountAsync(cancellationToken);
        var deslocamento = Paging.Offset(pagina);
        var contatos = await consulta.OrderBy(contato => contato.Nome).Skip(deslocamento).Take(Paging.PageSize).ToListAsync(cancellationToken);
        return new ListaDeContatos(contatos.Select(contato => ContatoResposta.De(contato)).ToList(), total, total > deslocamento + contatos.Count);
    }

    public async Task<ContatoResposta> MostrarAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var contato = await db.Contatos.AsNoTracking().Include(item => item.CamposExtras)
            .FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
            ?? throw AppException.NotFound(ErroNaoEncontrado);
        return ContatoResposta.De(contato, comCampos: true);
    }

    public async Task<ContatoResposta> ObterOuCriarAsync(DadosDoContato dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var existente = await db.Contatos.AsNoTracking()
            .FirstOrDefaultAsync(contato => contato.Numero == dados.Numero && contato.EmpresaId == empresaId, cancellationToken);
        if (existente is not null)
        {
            return ContatoResposta.De(existente);
        }

        var contato = await GravarNovoAsync(dados.Nome ?? string.Empty, dados.Numero ?? string.Empty, string.Empty, null, [], empresaId, cancellationToken);
        return ContatoResposta.De(contato);
    }

    public async Task<ContatoResposta> CriarAsync(DadosDoContato dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var numero = RemoverPrimeiro(RemoverPrimeiro(dados.Numero ?? string.Empty, "-"), " ");
        Validation.Required(dados.Nome, "name");
        Validation.Required(numero, "number");
        if (!numero.All(char.IsAsciiDigit))
        {
            throw new AppException(ErroFormatoDoNumero);
        }

        var conexao = await seletorDeConexao.PadraoAsync(empresaId, null, null, cancellationToken);
        var sessao = conexao.Id.ToString(CultureInfo.InvariantCulture);
        var jid = await VerificarNumeroAsync(sessao, numero, cancellationToken);
        var foto = await FotoAsync(sessao, jid, cancellationToken);

        var contato = await GravarNovoAsync(dados.Nome!, jid.Split('@')[0], dados.Email ?? string.Empty, foto, dados.CamposExtras ?? [], empresaId, cancellationToken);
        var resposta = ContatoResposta.De(contato, comCampos: true);
        await realtime.ToCompanyAsync(empresaId, "contact", new { action = "create", contact = resposta }, cancellationToken);
        return resposta;
    }

    public async Task<ContatoEditado> AtualizarAsync(int id, DadosDoContato dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        if (dados.Numero is not null && !dados.Numero.All(char.IsAsciiDigit))
        {
            throw new AppException(ErroFormatoDoNumero);
        }

        if (!string.IsNullOrEmpty(dados.Numero))
        {
            var conexao = await seletorDeConexao.PadraoAsync(empresaId, null, null, cancellationToken);
            await VerificarNumeroAsync(conexao.Id.ToString(CultureInfo.InvariantCulture), dados.Numero, cancellationToken);
        }

        var contato = await db.Contatos.Include(item => item.CamposExtras)
            .FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
            ?? throw AppException.NotFound(ErroNaoEncontrado);

        if (dados.CamposExtras is not null)
        {
            foreach (var campo in dados.CamposExtras)
            {
                var existente = campo.Id is null ? null : contato.CamposExtras.FirstOrDefault(item => item.Id == campo.Id);
                if (existente is null)
                {
                    contato.CamposExtras.Add(new CampoDoContato { Nome = campo.Nome ?? string.Empty, Valor = campo.Valor ?? string.Empty });
                }
                else
                {
                    existente.Nome = campo.Nome ?? existente.Nome;
                    existente.Valor = campo.Valor ?? existente.Valor;
                }
            }

            var manter = dados.CamposExtras.Where(campo => campo.Id is not null).Select(campo => campo.Id!.Value).ToHashSet();
            foreach (var antigo in contato.CamposExtras.Where(campo => campo.Id != 0 && !manter.Contains(campo.Id)).ToList())
            {
                contato.CamposExtras.Remove(antigo);
                db.CamposDosContatos.Remove(antigo);
            }
        }

        if (dados.Nome is not null) contato.Nome = dados.Nome;
        if (dados.Numero is not null) contato.Numero = dados.Numero;
        if (dados.Email is not null) contato.Email = dados.Email;
        await db.SaveChangesAsync(cancellationToken);

        var resposta = new ContatoEditado(contato.Id, contato.Nome, contato.Numero, contato.Email, contato.FotoDePerfil,
            contato.CamposExtras.OrderBy(campo => campo.Id).Select(CampoDoContatoResposta.De).ToList());
        await realtime.ToCompanyAsync(empresaId, "contact", new { action = "update", contact = resposta }, cancellationToken);
        return resposta;
    }

    public async Task<ContatoResposta> MarcarConhecidoAsync(int id, DadosDeConhecido dados, CancellationToken cancellationToken)
    {
        if (dados.Conhecido is not { } conhecido)
        {
            throw new AppException(ErroValorConhecido);
        }

        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var contato = await db.Contatos.FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
                      ?? throw AppException.NotFound(ErroNaoEncontrado);
        contato.Conhecido = conhecido;
        await db.SaveChangesAsync(cancellationToken);

        if (conhecido)
        {
            await db.Tickets.Where(ticket => ticket.ContatoId == id && ticket.EmpresaId == empresaId && ticket.Situacao == "pending")
                .ExecuteUpdateAsync(setters => setters.SetProperty(ticket => ticket.Situacao, "open").SetProperty(ticket => ticket.UsuarioId, (int?)null), cancellationToken);
        }

        var resposta = ContatoResposta.De(contato);
        await realtime.ToCompanyAsync(empresaId, "contact", new { action = "update", contact = resposta }, cancellationToken);
        return resposta;
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var contato = await db.Contatos.FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
                      ?? throw AppException.NotFound(ErroNaoEncontrado);
        db.Contatos.Remove(contato);
        await db.SaveChangesAsync(cancellationToken);
        await realtime.ToCompanyAsync(empresaId, "contact", new { action = "delete", contactId = id.ToString(CultureInfo.InvariantCulture) }, cancellationToken);
    }

    public async Task<IReadOnlyList<TicketDoContato>> TicketsAsync(int contatoId, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var tickets = await db.Tickets.AsNoTracking()
            .Include(ticket => ticket.Usuario)
            .Include(ticket => ticket.Fila)
            .Include(ticket => ticket.ConexaoWhatsapp)
            .Include(ticket => ticket.SituacaoDeEncerramento)
            .Where(ticket => ticket.ContatoId == contatoId && ticket.EmpresaId == empresaId)
            .OrderByDescending(ticket => ticket.CriadoEm)
            .Take(20)
            .ToListAsync(cancellationToken);

        return tickets.Select(ticket => new TicketDoContato(
            ticket.Id, ticket.Protocolo, ticket.Situacao, ticket.CriadoEm, ticket.EncerradoEm, ticket.UltimaMensagem, ticket.UsuarioId,
            ticket.Usuario is { } usuario ? new { id = usuario.Id, name = usuario.Nome } : null,
            ticket.Fila is { } fila ? new { id = fila.Id, name = fila.Nome, color = fila.Cor } : null,
            ticket.ConexaoWhatsapp is { } conexao ? new { id = conexao.Id, name = conexao.Nome } : null,
            ticket.SituacaoDeEncerramento is { } situacao ? new { id = situacao.Id, name = situacao.Nome, color = situacao.Cor } : null)).ToList();
    }

    public async Task ImportarDoAparelhoAsync(CancellationToken cancellationToken)
    {
        var usuario = usuarioAtual.Exigir();
        var empresaId = usuario.EmpresaId ?? throw AppException.Forbidden(ErrorCodes.CompanyRequired);
        var conexao = await seletorDeConexao.PadraoAsync(empresaId, usuario.Id, null, cancellationToken);

        IReadOnlyList<GatewayPhoneContact> doAparelho;
        try
        {
            doAparelho = await gateway.ListContactsAsync(conexao.Id.ToString(CultureInfo.InvariantCulture), cancellationToken);
        }
        catch (Exception exception) when (exception is GatewaySessionUnavailableException or HttpRequestException)
        {
            logger.LogError(exception, "Could not get whatsapp contacts from phone");
            return;
        }

        var existentes = (await db.Contatos.AsNoTracking().Where(contato => contato.EmpresaId == empresaId && contato.Numero != null)
            .Select(contato => contato.Numero!).ToListAsync(cancellationToken)).ToHashSet();
        foreach (var contato in doAparelho.Where(item => !string.IsNullOrEmpty(item.Number) && !existentes.Contains(item.Number)))
        {
            db.Contatos.Add(new Contato
            {
                Nome = string.IsNullOrEmpty(contato.Name) ? (string.IsNullOrEmpty(contato.PushName) ? contato.Number : contato.PushName) : contato.Name,
                Numero = contato.Number,
                EmpresaId = empresaId
            });
            existentes.Add(contato.Number);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<Contato> GravarNovoAsync(string nome, string numero, string email, string? foto, IEnumerable<CampoExtra> campos, int empresaId, CancellationToken cancellationToken)
    {
        if (await db.Contatos.AnyAsync(contato => contato.Numero == numero && contato.EmpresaId == empresaId, cancellationToken))
        {
            throw new AppException(ErroDuplicado);
        }

        var contato = new Contato
        {
            Nome = nome,
            Numero = numero,
            Email = email,
            FotoDePerfil = foto,
            EmpresaId = empresaId,
            CamposExtras = campos.Select(campo => new CampoDoContato { Nome = campo.Nome ?? string.Empty, Valor = campo.Valor ?? string.Empty }).ToList()
        };
        db.Contatos.Add(contato);
        await db.SaveChangesAsync(cancellationToken);
        return contato;
    }

    private async Task<string> VerificarNumeroAsync(string sessao, string numero, CancellationToken cancellationToken)
    {
        GatewayNumberCheck resultado;
        try
        {
            resultado = await gateway.CheckNumberAsync(sessao, numero, cancellationToken);
        }
        catch (Exception exception) when (exception is GatewaySessionUnavailableException or HttpRequestException)
        {
            logger.LogWarning(exception, "Could not check number on WhatsApp");
            throw new AppException(ErroVerificacao);
        }

        return resultado is { Exists: true, Jid: { } jid } ? jid : throw new AppException(ErroContatoInvalido);
    }

    private async Task<string?> FotoAsync(string sessao, string jid, CancellationToken cancellationToken)
    {
        try
        {
            return await gateway.GetProfilePictureAsync(sessao, jid, cancellationToken);
        }
        catch (Exception exception) when (exception is GatewaySessionUnavailableException or HttpRequestException)
        {
            logger.LogDebug(exception, "Could not get profile picture");
            return null;
        }
    }

    private static string RemoverPrimeiro(string texto, string trecho)
    {
        var indice = texto.IndexOf(trecho, StringComparison.Ordinal);
        return indice < 0 ? texto : texto.Remove(indice, trecho.Length);
    }
}
