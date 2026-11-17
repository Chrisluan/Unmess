using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Unmess.Application.WhatsappGateway;
using Unmess.Infrastructure.Database;
using Unmess.Infrastructure.WhatsappGateway;

namespace Unmess.Infrastructure;

public static class DependencyInjection
{
    public const string ReadyTag = "ready";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.SectionName));
        services.Configure<WhatsappGatewayOptions>(configuration.GetSection(WhatsappGatewayOptions.SectionName));

        services.AddHttpClient<IWhatsappGateway, WhatsappGatewayClient>(client => client.Timeout = TimeSpan.FromSeconds(30));
        services.AddScoped<IGatewayEventHandler, LoggingGatewayEventHandler>();
        services.AddMemoryCache();

        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>("database", tags: [ReadyTag]);

        return services;
    }
}
