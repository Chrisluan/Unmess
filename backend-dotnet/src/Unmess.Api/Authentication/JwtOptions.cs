namespace Unmess.Api.Authentication;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public const string LegacySecretKey = "JWT_SECRET";

    public string Secret { get; set; } = string.Empty;
}
