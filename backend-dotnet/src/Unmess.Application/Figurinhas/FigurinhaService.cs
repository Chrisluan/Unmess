using System.Security.Cryptography;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Domain.Figurinhas;

namespace Unmess.Application.Figurinhas;

public sealed record FigurinhaResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("fileName")] string? Arquivo,
    [property: JsonPropertyName("animated")] bool Animada,
    [property: JsonPropertyName("size")] int Tamanho,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm,
    [property: JsonPropertyName("companyId")] int EmpresaId)
{
    public static FigurinhaResposta De(Figurinha figurinha) => new(
        figurinha.Id,
        figurinha.Nome,
        string.IsNullOrEmpty(figurinha.NomeDoArquivo) ? null : $"/public/{figurinha.NomeDoArquivo}",
        figurinha.Animada,
        figurinha.Tamanho,
        figurinha.CriadoEm,
        figurinha.AtualizadoEm,
        figurinha.EmpresaId);
}

public sealed record FigurinhaConvertida(bool Animada, long Tamanho);

public interface IConversorDeFigurinha
{
    Task<FigurinhaConvertida> ConverterAsync(string origem, string destino, string? tipoDeConteudo, CancellationToken cancellationToken);
}

public sealed class FigurinhaService(
    IUnmessDbContext db,
    IUsuarioAtual usuarioAtual,
    IFileStorage arquivos,
    IConversorDeFigurinha conversor,
    TimeProvider timeProvider)
{
    public const string ErroNaoEncontrada = "ERR_NO_STICKER_FOUND";
    public const string ErroSemArquivo = "ERR_NO_FILE_UPLOADED";
    public const int TamanhoMaximoDoNome = 60;

    public async Task<object> ListarAsync(string? busca, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var consulta = db.Figurinhas.AsNoTracking().Where(figurinha => figurinha.EmpresaId == empresaId);
        var termo = busca?.Trim();
        if (!string.IsNullOrEmpty(termo))
        {
            consulta = consulta.Where(figurinha => EF.Functions.Like(figurinha.Nome, $"%{termo}%"));
        }

        var figurinhas = await consulta.OrderBy(figurinha => figurinha.Nome).ToListAsync(cancellationToken);
        return new { stickers = figurinhas.Select(FigurinhaResposta.De).ToList() };
    }

    public async Task<FigurinhaResposta> CriarAsync(string? nome, ArquivoEnviado? arquivo, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        Validation.Required(nome, "name");
        if (nome!.Length > TamanhoMaximoDoNome)
        {
            throw new AppException($"name must be at most {TamanhoMaximoDoNome} characters");
        }
        if (arquivo is null)
        {
            throw new AppException(ErroSemArquivo);
        }
        arquivos.ExigirTipoPermitido(arquivo.TipoDeConteudo);

        var origem = Path.Combine(Path.GetTempPath(), $"unmess-figurinha-{Guid.NewGuid():N}{Path.GetExtension(arquivo.NomeOriginal).ToLowerInvariant()}");
        var nomeFinal = NomeDoArquivo();
        FigurinhaConvertida resultado;
        try
        {
            await using (var destinoTemporario = File.Create(origem))
            await using (var conteudo = arquivo.Abrir())
            {
                await conteudo.CopyToAsync(destinoTemporario, cancellationToken);
            }

            resultado = await conversor.ConverterAsync(origem, arquivos.CaminhoCompleto(nomeFinal), arquivo.TipoDeConteudo, cancellationToken);
        }
        finally
        {
            File.Delete(origem);
        }

        var figurinha = new Figurinha
        {
            Nome = nome,
            NomeDoArquivo = nomeFinal,
            Animada = resultado.Animada,
            Tamanho = (int)resultado.Tamanho,
            EmpresaId = empresaId
        };
        db.Figurinhas.Add(figurinha);
        await db.SaveChangesAsync(cancellationToken);
        return FigurinhaResposta.De(figurinha);
    }

    public async Task RemoverAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var figurinha = await db.Figurinhas.FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
                        ?? throw AppException.NotFound(ErroNaoEncontrada);
        var arquivo = figurinha.NomeDoArquivo;
        db.Figurinhas.Remove(figurinha);
        await db.SaveChangesAsync(cancellationToken);
        arquivos.Remover(arquivo);
    }

    private string NomeDoArquivo() =>
        $"figurinha-{timeProvider.GetUtcNow().ToUnixTimeMilliseconds()}-{Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(12))}.webp";
}
