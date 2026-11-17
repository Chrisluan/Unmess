namespace Unmess.Infrastructure.Security;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public const string LegacySecretKey = "JWT_SECRET";
    public const string LegacyRefreshSecretKey = "JWT_REFRESH_SECRET";

    public string Secret { get; set; } = string.Empty;
    public string RefreshSecret { get; set; } = string.Empty;
    public TimeSpan AccessTokenLifetime { get; set; } = TimeSpan.FromMinutes(15);
    public TimeSpan RefreshTokenLifetime { get; set; } = TimeSpan.FromDays(7);
}
