using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Unmess.Deployer.Events;

public enum SignatureCheck
{
    Valid,
    Missing,
    Stale,
    Mismatch
}

public static class EventSignature
{
    public const string TimestampHeader = "X-Unmess-Timestamp";
    public const string SignatureHeader = "X-Unmess-Signature";
    public const string DeliveryHeader = "X-Unmess-Delivery";
    private const string Prefix = "sha256=";

    public static string Compute(string secret, long timestamp, string body)
    {
        var payload = Encoding.UTF8.GetBytes($"{timestamp.ToString(CultureInfo.InvariantCulture)}.{body}");
        var hash = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), payload);
        return Prefix + Convert.ToHexStringLower(hash);
    }

    public static SignatureCheck Verify(
        string secret,
        string? timestampHeader,
        string? signatureHeader,
        string body,
        DateTimeOffset now,
        TimeSpan tolerance)
    {
        if (string.IsNullOrWhiteSpace(timestampHeader) || string.IsNullOrWhiteSpace(signatureHeader) ||
            !long.TryParse(timestampHeader, NumberStyles.None, CultureInfo.InvariantCulture, out var timestamp))
        {
            return SignatureCheck.Missing;
        }

        if (timestamp < now.ToUnixTimeSeconds() - (long)tolerance.TotalSeconds ||
            timestamp > now.ToUnixTimeSeconds() + (long)tolerance.TotalSeconds)
        {
            return SignatureCheck.Stale;
        }

        var expected = Encoding.ASCII.GetBytes(Compute(secret, timestamp, body));
        var received = Encoding.ASCII.GetBytes(signatureHeader.Trim());

        return CryptographicOperations.FixedTimeEquals(expected, received) ? SignatureCheck.Valid : SignatureCheck.Mismatch;
    }
}
