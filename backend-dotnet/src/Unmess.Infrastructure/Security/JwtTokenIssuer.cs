using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Unmess.Application.Authentication;

namespace Unmess.Infrastructure.Security;

public sealed class JwtTokenIssuer(IOptions<JwtOptions> options, TimeProvider timeProvider) : ITokenIssuer
{
    private readonly JsonWebTokenHandler handler = new() { SetDefaultTimesOnTokenCreation = false };

    public string CreateAccessToken(AccessTokenClaims claims)
    {
        var payload = new JsonObject
        {
            ["username"] = claims.Username,
            ["profile"] = claims.Profile,
            ["id"] = claims.UserId,
            ["companyId"] = claims.CompanyId,
            ["companyName"] = claims.CompanyName
        };
        return Sign(payload, options.Value.Secret, options.Value.AccessTokenLifetime);
    }

    public string CreateRefreshToken(RefreshTokenClaims claims)
    {
        var payload = new JsonObject
        {
            ["id"] = claims.UserId,
            ["tokenVersion"] = claims.TokenVersion
        };
        return Sign(payload, options.Value.RefreshSecret, options.Value.RefreshTokenLifetime);
    }

    public RefreshTokenClaims? ReadRefreshToken(string token)
    {
        if (Decode(token) is not { } parts || !IsHs256(parts.Header) || !SignatureMatches(token, options.Value.RefreshSecret))
        {
            return null;
        }

        using var payload = parts.Payload;
        var root = payload.RootElement;
        if (ReadLong(root, "exp") is not { } exp || exp < timeProvider.GetUtcNow().ToUnixTimeSeconds())
        {
            return null;
        }

        return ReadInt(root, "id") is { } id && ReadInt(root, "tokenVersion") is { } version
            ? new RefreshTokenClaims(id, version)
            : null;
    }

    public AccessTokenClaims? ReadAccessTokenWithoutValidation(string token)
    {
        var raw = token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? token[7..].Trim() : token.Trim();
        if (Decode(raw) is not { } parts)
        {
            return null;
        }

        using var payload = parts.Payload;
        parts.Header.Dispose();
        var root = payload.RootElement;
        return new AccessTokenClaims(
            ReadInt(root, "id") ?? 0,
            ReadString(root, "username") ?? string.Empty,
            ReadString(root, "profile") ?? string.Empty,
            ReadInt(root, "companyId"),
            ReadString(root, "companyName"));
    }

    private string Sign(JsonObject payload, string secret, TimeSpan lifetime)
    {
        var now = timeProvider.GetUtcNow().ToUnixTimeSeconds();
        payload["iat"] = now;
        payload["exp"] = now + (long)lifetime.TotalSeconds;
        return handler.CreateToken(payload.ToJsonString(), new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)), SecurityAlgorithms.HmacSha256));
    }

    private static (JsonDocument Header, JsonDocument Payload)? Decode(string token)
    {
        var segments = token.Split('.');
        if (segments.Length != 3)
        {
            return null;
        }

        try
        {
            return (JsonDocument.Parse(Base64UrlEncoder.DecodeBytes(segments[0])), JsonDocument.Parse(Base64UrlEncoder.DecodeBytes(segments[1])));
        }
        catch (Exception exception) when (exception is FormatException or JsonException or ArgumentException)
        {
            return null;
        }
    }

    private static bool IsHs256(JsonDocument header)
    {
        using (header)
        {
            return ReadString(header.RootElement, "alg") == SecurityAlgorithms.HmacSha256;
        }
    }

    private static bool SignatureMatches(string token, string secret)
    {
        var lastDot = token.LastIndexOf('.');
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.ASCII.GetBytes(token[..lastDot]));
        try
        {
            return CryptographicOperations.FixedTimeEquals(expected, Base64UrlEncoder.DecodeBytes(token[(lastDot + 1)..]));
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static string? ReadString(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static long? ReadLong(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var number) ? number : null;

    private static int? ReadInt(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.Number when value.TryGetInt32(out var number) => number,
            JsonValueKind.String when int.TryParse(value.GetString(), out var parsed) => parsed,
            _ => null
        };
    }
}
