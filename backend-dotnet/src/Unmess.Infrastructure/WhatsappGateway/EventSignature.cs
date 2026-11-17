using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Unmess.Infrastructure.WhatsappGateway;

public static class EventSignature
{
    public const string TimestampHeader = "X-Unmess-Timestamp";
    public const string SignatureHeader = "X-Unmess-Signature";
    public const string DeliveryHeader = "X-Unmess-Delivery";

    public static string Compute(string secret, long timestamp, string body)
    {
        var hash = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(secret),
            Encoding.UTF8.GetBytes($"{timestamp.ToString(CultureInfo.InvariantCulture)}.{body}"));
        return "sha256=" + Convert.ToHexStringLower(hash);
    }

    public static bool IsValid(string secret, string? timestampHeader, string? signatureHeader, string body, DateTimeOffset now, TimeSpan tolerance)
    {
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(signatureHeader) ||
            !long.TryParse(timestampHeader, NumberStyles.None, CultureInfo.InvariantCulture, out var timestamp) ||
            Math.Abs(now.ToUnixTimeSeconds() - timestamp) > (long)tolerance.TotalSeconds)
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(Compute(secret, timestamp, body)),
            Encoding.ASCII.GetBytes(signatureHeader.Trim()));
    }
}
