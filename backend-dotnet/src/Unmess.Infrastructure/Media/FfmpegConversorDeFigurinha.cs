using System.Buffers.Binary;
using System.Diagnostics;
using System.Globalization;
using System.Text;
using Microsoft.Extensions.Options;
using Unmess.Application.Common;
using Unmess.Application.Figurinhas;

namespace Unmess.Infrastructure.Media;

public sealed class MediaOptions
{
    public const string SectionName = "Media";

    public string FfmpegPath { get; set; } = "ffmpeg";
}

public sealed class FfmpegConversorDeFigurinha(IOptions<MediaOptions> options) : IConversorDeFigurinha
{
    private const long LimiteEstatica = 100 * 1024;
    private const long LimiteAnimada = 500 * 1024;
    private const int DuracaoMaximaEmSegundos = 8;
    private const string FiltroQuadrado = "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000";
    private static readonly HashSet<string> ExtensoesAnimadas = [".gif", ".mp4", ".webm", ".mov", ".mkv"];

    public async Task<FigurinhaConvertida> ConverterAsync(string origem, string destino, string? tipoDeConteudo, CancellationToken cancellationToken)
    {
        if (InspecionarWebp(origem) is { } webp)
        {
            var tamanho = new FileInfo(origem).Length;
            var limite = webp.Animada ? LimiteAnimada : LimiteEstatica;
            var dimensoesCertas = webp.Largura is <= 512 && webp.Altura is <= 512;
            if (tamanho <= limite && dimensoesCertas)
            {
                File.Copy(origem, destino, overwrite: true);
                return new FigurinhaConvertida(webp.Animada, tamanho);
            }

            if (webp.Animada)
            {
                throw new AppException(
                    "Esta figurinha animada não pode ser aproveitada: ela precisa ter no " +
                    $"máximo 512x512 e {LimiteAnimada / 1024} KB " +
                    $"(esta tem {Texto(webp.Largura)}x{Texto(webp.Altura)} e {Math.Round(tamanho / 1024d)} KB). " +
                    "Envie o GIF ou vídeo original, que eu converto.");
            }
        }

        return EhAnimada(origem, tipoDeConteudo)
            ? await ConverterAnimadaAsync(origem, destino, cancellationToken)
            : await ConverterEstaticaAsync(origem, destino, cancellationToken);
    }

    private async Task<FigurinhaConvertida> ConverterEstaticaAsync(string origem, string destino, CancellationToken cancellationToken)
    {
        foreach (var qualidade in new[] { 80, 60, 45, 30, 20 })
        {
            await FfmpegAsync(["-y", "-i", origem, "-vf", FiltroQuadrado, "-c:v", "libwebp", "-lossless", "0", "-q:v", Numero(qualidade),
                "-preset", "default", "-an", "-fps_mode", "passthrough", destino], cancellationToken);
            var tamanho = new FileInfo(destino).Length;
            if (tamanho <= LimiteEstatica)
            {
                return new FigurinhaConvertida(false, tamanho);
            }
        }

        throw new AppException(
            $"Não consegui deixar a figurinha abaixo de {LimiteEstatica / 1024} KB " +
            $"(ficou em {Math.Round(new FileInfo(destino).Length / 1024d)} KB). Tente uma imagem mais simples.");
    }

    private async Task<FigurinhaConvertida> ConverterAnimadaAsync(string origem, string destino, CancellationToken cancellationToken)
    {
        foreach (var (qualidade, quadros) in new[] { (70, 15), (50, 12), (35, 10), (25, 8) })
        {
            await FfmpegAsync(["-y", "-t", Numero(DuracaoMaximaEmSegundos), "-i", origem, "-vf", $"{FiltroQuadrado},fps={Numero(quadros)}",
                "-c:v", "libwebp_anim", "-lossless", "0", "-q:v", Numero(qualidade), "-preset", "default", "-loop", "0", "-an",
                "-fps_mode", "passthrough", destino], cancellationToken);
            var tamanho = new FileInfo(destino).Length;
            if (tamanho <= LimiteAnimada)
            {
                return new FigurinhaConvertida(true, tamanho);
            }
        }

        throw new AppException(
            $"Não consegui deixar a figurinha animada abaixo de {LimiteAnimada / 1024} KB " +
            $"(ficou em {Math.Round(new FileInfo(destino).Length / 1024d)} KB). Tente um vídeo mais curto ou com menos movimento.");
    }

    private async Task FfmpegAsync(IReadOnlyList<string> argumentos, CancellationToken cancellationToken)
    {
        var inicio = new ProcessStartInfo(options.Value.FfmpegPath)
        {
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        foreach (var argumento in argumentos)
        {
            inicio.ArgumentList.Add(argumento);
        }

        Process? iniciado;
        try
        {
            iniciado = Process.Start(inicio);
        }
        catch (System.ComponentModel.Win32Exception)
        {
            iniciado = null;
        }

        using var processo = iniciado ?? throw new AppException("ffmpeg não disponível nesta instalação.");
        using var tempoLimite = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        tempoLimite.CancelAfter(TimeSpan.FromMinutes(2));
        var erros = processo.StandardError.ReadToEndAsync(tempoLimite.Token);
        await processo.StandardOutput.ReadToEndAsync(tempoLimite.Token);
        await processo.WaitForExitAsync(tempoLimite.Token);
        if (processo.ExitCode != 0)
        {
            var detalhe = await erros;
            throw new AppException($"Falha ao converter a figurinha: {detalhe[^Math.Min(300, detalhe.Length)..]}");
        }
    }

    private static bool EhAnimada(string origem, string? tipoDeConteudo) =>
        tipoDeConteudo?.StartsWith("video/", StringComparison.OrdinalIgnoreCase) == true ||
        tipoDeConteudo == "image/gif" ||
        ExtensoesAnimadas.Contains(Path.GetExtension(origem).ToLowerInvariant());

    private static InfoWebp? InspecionarWebp(string arquivo)
    {
        Span<byte> cabecalho = stackalloc byte[30];
        int lidos;
        using (var fluxo = File.OpenRead(arquivo))
        {
            lidos = fluxo.Read(cabecalho);
        }

        if (lidos < 16 || Encoding.ASCII.GetString(cabecalho[..4]) != "RIFF" || Encoding.ASCII.GetString(cabecalho[8..12]) != "WEBP")
        {
            return null;
        }

        if (Encoding.ASCII.GetString(cabecalho[12..16]) == "VP8X" && lidos >= 30)
        {
            return new InfoWebp(
                (cabecalho[20] & 0x02) != 0,
                1 + (int)(BinaryPrimitives.ReadUInt32LittleEndian([cabecalho[24], cabecalho[25], cabecalho[26], 0])),
                1 + (int)(BinaryPrimitives.ReadUInt32LittleEndian([cabecalho[27], cabecalho[28], cabecalho[29], 0])));
        }

        return new InfoWebp(false, null, null);
    }

    private static string Numero(int valor) => valor.ToString(CultureInfo.InvariantCulture);

    private static string Texto(int? valor) => valor?.ToString(CultureInfo.InvariantCulture) ?? "?";

    private sealed record InfoWebp(bool Animada, int? Largura, int? Altura);
}
