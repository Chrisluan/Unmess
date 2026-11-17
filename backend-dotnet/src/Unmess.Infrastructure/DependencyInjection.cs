using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Unmess.Application.Authentication;
using Unmess.Application.Common;
using Unmess.Application.WhatsappGateway;
using Unmess.Application.Figurinhas;
using Unmess.Infrastructure.Database;
using Unmess.Infrastructure.Media;
using Unmess.Infrastructure.Security;
using Unmess.Infrastructure.Storage;
using Unmess.Infrastructure.WhatsappGateway;

namespace Unmess.Infrastructure;

public static class DependencyInjection
{
    public const string ReadyTag = "ready";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.SectionName));
        services.Configure<WhatsappGatewayOptions>(configuration.GetSection(WhatsappGatewayOptions.SectionName));
        services.Configure<UploadOptions>(configuration.GetSection(UploadOptions.SectionName));

        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .PostConfigure(options =>
            {
                if (string.IsNullOrWhiteSpace(options.Secret))
                {
                    options.Secret = configuration[JwtOptions.LegacySecretKey] ?? string.Empty;
                }
                if (string.IsNullOrWhiteSpace(options.RefreshSecret))
                {
                    options.RefreshSecret = configuration[JwtOptions.LegacyRefreshSecretKey] ?? string.Empty;
                }
            })
            .Validate(options => !string.IsNullOrWhiteSpace(options.Secret), "Jwt:Secret or JWT_SECRET must be configured.")
            .Validate(options => !string.IsNullOrWhiteSpace(options.RefreshSecret), "Jwt:RefreshSecret or JWT_REFRESH_SECRET must be configured.")
            .ValidateOnStart();

        services.AddSingleton<DatabaseClock>();
        services.AddDbContext<UnmessDbContext>((provider, options) =>
            options.UseMySQL(provider.GetRequiredService<IOptions<DatabaseOptions>>().Value.ConnectionString ?? string.Empty));
        services.AddScoped<IUnmessDbContext>(provider => provider.GetRequiredService<UnmessDbContext>());

        services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
        services.AddSingleton<ITokenIssuer, JwtTokenIssuer>();
        services.AddSingleton<IFileStorage, LocalFileStorage>();
        services.Configure<MediaOptions>(configuration.GetSection(MediaOptions.SectionName));
        services.AddSingleton<IConversorDeFigurinha, FfmpegConversorDeFigurinha>();
        services.AddSingleton<Unmess.Application.Mensagens.IConversorDeAudio, FfmpegConversorDeAudio>();

        services.AddHttpClient<IWhatsappGateway, WhatsappGatewayClient>(client => client.Timeout = TimeSpan.FromSeconds(30));
        services.AddMemoryCache();

        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>("database", tags: [ReadyTag]);

        return services;
    }
}
