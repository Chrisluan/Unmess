using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Domain.Conexoes;

namespace Unmess.Application.Conexoes;

public static class SituacaoDaConexao
{
    public const string Conectada = "CONNECTED";
}

public sealed class SeletorDeConexao(IUnmessDbContext db)
{
    public const string ErroSemConexaoPadrao = "ERR_NO_DEF_WAPP_FOUND";
    public const string ErroConexaoNaoIniciada = "ERR_WAPP_NOT_INITIALIZED";

    public async Task<ConexaoWhatsapp> PadraoAsync(int empresaId, int? usuarioId, int? conexaoId, CancellationToken cancellationToken)
    {
        if (conexaoId is not null)
        {
            var escolhida = await db.ConexoesWhatsapp.AsNoTracking()
                .FirstOrDefaultAsync(conexao => conexao.Id == conexaoId && conexao.EmpresaId == empresaId, cancellationToken)
                ?? throw new AppException(ErroSemConexaoPadrao);
            return escolhida.Situacao == SituacaoDaConexao.Conectada ? escolhida : throw new AppException(ErroConexaoNaoIniciada);
        }

        if (usuarioId is not null)
        {
            var doUsuario = await db.Usuarios.AsNoTracking()
                .Where(usuario => usuario.Id == usuarioId)
                .Select(usuario => usuario.ConexaoWhatsapp)
                .FirstOrDefaultAsync(cancellationToken);
            if (doUsuario?.Situacao == SituacaoDaConexao.Conectada)
            {
                return doUsuario;
            }
        }

        var padrao = await db.ConexoesWhatsapp.AsNoTracking()
            .FirstOrDefaultAsync(conexao => conexao.Padrao && conexao.EmpresaId == empresaId, cancellationToken);
        if (padrao?.Situacao == SituacaoDaConexao.Conectada)
        {
            return padrao;
        }

        var qualquerConectada = await db.ConexoesWhatsapp.AsNoTracking()
            .FirstOrDefaultAsync(conexao => conexao.EmpresaId == empresaId && conexao.Situacao == SituacaoDaConexao.Conectada, cancellationToken);
        return qualquerConectada ?? padrao ?? throw new AppException(ErroSemConexaoPadrao);
    }
}
