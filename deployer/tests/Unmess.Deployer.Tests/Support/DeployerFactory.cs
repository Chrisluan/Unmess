using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Unmess.Deployer.Api;
using Unmess.Deployer.Events;
using Unmess.Deployer.Integrations;

namespace Unmess.Deployer.Tests.Support;

public sealed class DeployerFactory : WebApplicationFactory<Program>
{
    public const string WebhookSecret = "test-webhook-secret";
    public const string ApiToken = "test-api-token";

    private readonly string databasePath = Path.Combine(Path.GetTempPath(), $"unmess-deployer-{Guid.NewGuid():N}.db");

    public FakeSourceControl SourceControl { get; } = new();
    public RecordingOrchestrator Orchestrator { get; } = new();
    public FakeHealthProbe HealthProbe { get; }

    public DeployerFactory()
    {
        HealthProbe = new FakeHealthProbe(Orchestrator);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Deployer:DatabasePath", databasePath);
        builder.UseSetting("Deployer:WebhookSecret", WebhookSecret);
        builder.UseSetting("Deployer:ApiToken", ApiToken);
        builder.UseSetting("Deployer:PreviewUrlTemplate", "https://{release}.unmess.test");
        builder.UseSetting("Deployer:ProductionUrl", "https://app.unmess.test");
        builder.UseSetting("Deployer:HealthCheckWindow", "00:00:00.300");
        builder.UseSetting("Deployer:HealthCheckInterval", "00:00:00.010");
        builder.UseSetting("Deployer:RequiredHealthyChecks", "2");
        builder.UseSetting("Deployer:ReconciliationInterval", "01:00:00");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<ISourceControl>();
            services.RemoveAll<IContainerOrchestrator>();
            services.RemoveAll<IHealthProbe>();
            services.AddSingleton<ISourceControl>(SourceControl);
            services.AddSingleton<IContainerOrchestrator>(Orchestrator);
            services.AddSingleton<IHealthProbe>(HealthProbe);
        });
    }

    public HttpClient CreateAuthorizedClient()
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ApiToken);
        return client;
    }

    public static HttpRequestMessage SignedEvent(object payload, string? deliveryId = null, string secret = WebhookSecret, DateTimeOffset? at = null)
    {
        var body = System.Text.Json.JsonSerializer.Serialize(payload);
        var timestamp = (at ?? DateTimeOffset.UtcNow).ToUnixTimeSeconds();
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/events/github")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        request.Headers.Add(EventSignature.TimestampHeader, timestamp.ToString(System.Globalization.CultureInfo.InvariantCulture));
        request.Headers.Add(EventSignature.SignatureHeader, EventSignature.Compute(secret, timestamp, body));
        request.Headers.Add(EventSignature.DeliveryHeader, deliveryId ?? Guid.NewGuid().ToString("N"));
        return request;
    }

    public static object ReleaseUpdated(string release, string sha) => new
    {
        type = CiEventTypes.ReleaseUpdated,
        release,
        commitSha = sha,
        imageTag = $"sha-{sha}",
        ciPassed = true
    };

    public async Task<ReleaseResponse> WaitForStateAsync(string release, string state)
    {
        var client = CreateAuthorizedClient();
        ReleaseResponse? last = null;
        for (var attempt = 0; attempt < 200; attempt++)
        {
            last = await client.GetFromJsonAsync<ReleaseResponse>($"/api/v1/releases/{release}");
            if (last?.State == state)
            {
                return last;
            }

            await Task.Delay(25);
        }

        throw new TimeoutException($"Release {release} stayed in {last?.State} instead of reaching {state}. Last error: {last?.LastError}");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
            File.Delete(databasePath);
        }
    }
}
