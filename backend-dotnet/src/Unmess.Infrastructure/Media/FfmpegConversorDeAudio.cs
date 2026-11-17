using System.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Unmess.Application.Mensagens;

namespace Unmess.Infrastructure.Media;

public sealed class FfmpegConversorDeAudio(IOptions<MediaOptions> options, ILogger<FfmpegConversorDeAudio> logger) : IConversorDeAudio
{
    public async Task<AudioConvertido?> ParaMensagemDeVozAsync(string arquivo, CancellationToken cancellationToken)
    {
        var destino = Path.Combine(Path.GetDirectoryName(arquivo)!, $"{Path.GetFileNameWithoutExtension(arquivo)}.ogg");
        if (string.Equals(destino, arquivo, StringComparison.OrdinalIgnoreCase))
        {
            destino = Path.Combine(Path.GetDirectoryName(arquivo)!, $"{Path.GetFileNameWithoutExtension(arquivo)}-voz.ogg");
        }

        var inicio = new ProcessStartInfo(options.Value.FfmpegPath)
        {
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        foreach (var argumento in new[] { "-y", "-i", arquivo, "-vn", "-c:a", "libopus", "-b:a", "64k", "-ar", "48000", "-ac", "1", destino })
        {
            inicio.ArgumentList.Add(argumento);
        }

        try
        {
            using var processo = Process.Start(inicio);
            if (processo is null)
            {
                return null;
            }

            using var tempoLimite = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            tempoLimite.CancelAfter(TimeSpan.FromMinutes(2));
            var erros = processo.StandardError.ReadToEndAsync(tempoLimite.Token);
            await processo.StandardOutput.ReadToEndAsync(tempoLimite.Token);
            await processo.WaitForExitAsync(tempoLimite.Token);
            if (processo.ExitCode != 0 || !File.Exists(destino) || new FileInfo(destino).Length == 0)
            {
                logger.LogError("Could not convert audio to Ogg/Opus: {Details}", await erros);
                return null;
            }

            return new AudioConvertido(destino, "audio/ogg; codecs=opus");
        }
        catch (Exception exception) when (exception is System.ComponentModel.Win32Exception or OperationCanceledException or IOException)
        {
            logger.LogWarning(exception, "ffmpeg unavailable; sending the audio without converting");
            return null;
        }
    }
}
