using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Unmess.Api.Tests.Support;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string Secret = "test-secret-with-enough-length-for-hmac-sha256";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("JWT_SECRET", Secret);
        builder.UseSetting("JWT_REFRESH_SECRET", Secret + "-refresh");
        builder.UseSetting("Uploads:Directory", Path.Combine(Path.GetTempPath(), "unmess-tests-uploads"));
        builder.UseSetting("Database:ConnectionString", string.Empty);
    }

    public static string CreateLegacyToken(
        IDictionary<string, object?> claims,
        string secret = Secret,
        DateTime? expires = null)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Claims = claims.ToDictionary(pair => pair.Key, pair => pair.Value!),
            Expires = expires ?? DateTime.UtcNow.AddMinutes(15),
            NotBefore = (expires ?? DateTime.UtcNow.AddMinutes(15)).AddMinutes(-30),
            IssuedAt = (expires ?? DateTime.UtcNow.AddMinutes(15)).AddMinutes(-30),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                SecurityAlgorithms.HmacSha256)
        };

        return new JsonWebTokenHandler().CreateToken(descriptor);
    }
}
