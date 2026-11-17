using System.Globalization;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Unmess.Application.Common;

namespace Unmess.Infrastructure.Storage;

public sealed class UploadOptions
{
    public const string SectionName = "Uploads";

    public string Directory { get; set; } = "public";
    public long MaxFileBytes { get; set; } = 25 * 1024 * 1024;
}

public sealed partial class LocalFileStorage(IOptions<UploadOptions> options, TimeProvider timeProvider, ILogger<LocalFileStorage> logger) : IFileStorage
{
    public const string FileTypeNotAllowed = "Tipo de arquivo não permitido: {0}";

    public static readonly IReadOnlySet<string> AllowedTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/mp4",
        "video/mp4", "video/webm", "video/3gpp", "video/quicktime",
        "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/csv"
    };

    [GeneratedRegex("^\\.[a-z0-9]{1,9}$")]
    private static partial Regex SafeExtension();

    private string Root => Path.GetFullPath(options.Value.Directory);

    public async Task<string> SalvarAsync(ArquivoEnviado arquivo, CancellationToken cancellationToken)
    {
        if (!AllowedTypes.Contains(arquivo.TipoDeConteudo))
        {
            throw new AppException(string.Format(CultureInfo.InvariantCulture, FileTypeNotAllowed, arquivo.TipoDeConteudo));
        }

        if (arquivo.Tamanho > options.Value.MaxFileBytes)
        {
            throw new AppException("File too large");
        }

        var extension = Path.GetExtension(arquivo.NomeOriginal).ToLowerInvariant();
        extension = extension.Length > 10 ? extension[..10] : extension;
        var name = string.Create(CultureInfo.InvariantCulture,
            $"{timeProvider.GetUtcNow().ToUnixTimeMilliseconds()}-{Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16))}{(SafeExtension().IsMatch(extension) ? extension : string.Empty)}");

        Directory.CreateDirectory(Root);
        await using var source = arquivo.Abrir();
        await using var target = File.Create(Path.Combine(Root, name));
        await source.CopyToAsync(target, cancellationToken);
        return name;
    }

    public void Remover(string? nomeDoArquivo)
    {
        if (string.IsNullOrEmpty(nomeDoArquivo))
        {
            return;
        }

        try
        {
            var path = CaminhoCompleto(nomeDoArquivo);
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(exception, "Could not remove uploaded file {File}", nomeDoArquivo);
        }
    }

    public string CaminhoCompleto(string nomeDoArquivo) => Path.Combine(Root, Path.GetFileName(nomeDoArquivo));
}
