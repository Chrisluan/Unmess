namespace Unmess.Application.Common;

public sealed record ArquivoEnviado(string NomeOriginal, string TipoDeConteudo, long Tamanho, Func<Stream> Abrir);

public interface IFileStorage
{
    Task<string> SalvarAsync(ArquivoEnviado arquivo, CancellationToken cancellationToken);
    void Remover(string? nomeDoArquivo);
    string CaminhoCompleto(string nomeDoArquivo);
}
