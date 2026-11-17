using System.Text.RegularExpressions;

namespace Unmess.Api.Http;

public sealed partial class AllowedOrigins(IConfiguration configuration)
{
    [GeneratedRegex(@"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")]
    private static partial Regex Loopback();

    [GeneratedRegex(@"^https?://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$")]
    private static partial Regex PrivateNetwork();

    [GeneratedRegex(@"^https?://100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}(:\d+)?$")]
    private static partial Regex Tailscale();

    [GeneratedRegex(@"^https?://[\w-]+\.local(:\d+)?$")]
    private static partial Regex Mdns();

    [GeneratedRegex(@"^https?://[a-z0-9][a-z0-9-]*(:\d+)?$", RegexOptions.IgnoreCase)]
    private static partial Regex LocalHostname();

    public bool IsAllowed(string? origin)
    {
        if (string.IsNullOrEmpty(origin))
        {
            return true;
        }

        return Loopback().IsMatch(origin) ||
               PrivateNetwork().IsMatch(origin) ||
               Tailscale().IsMatch(origin) ||
               Mdns().IsMatch(origin) ||
               LocalHostname().IsMatch(origin) ||
               PublicOrigins().Contains(Normalize(origin));
    }

    private IEnumerable<string> PublicOrigins() =>
        (configuration["PUBLIC_ORIGINS"] ?? configuration["Cors:PublicOrigins"] ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(Normalize)
            .Where(origin => origin.Length > 0);

    private static string Normalize(string origin) => origin.Trim().TrimEnd('/').ToLowerInvariant();
}
