using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Serilog;
using Serilog.Formatting.Compact;
using Unmess.Deployer;
using Unmess.Deployer.Api;
using Unmess.Deployer.Data;
using Unmess.Deployer.Integrations;
using Unmess.Deployer.Releases;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseWindowsService(options => options.ServiceName = "UnmessDeployer");
builder.Host.UseSystemd();

builder.Services.AddSerilog((services, logger) => logger
    .ReadFrom.Configuration(builder.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .WriteTo.Console(new RenderedCompactJsonFormatter()));

builder.Services.AddOptions<DeployerOptions>()
    .Bind(builder.Configuration.GetSection(DeployerOptions.SectionName))
    .Validate(options => !string.IsNullOrWhiteSpace(options.WebhookSecret), "Deployer:WebhookSecret must be configured.")
    .Validate(options => !string.IsNullOrWhiteSpace(options.ApiToken), "Deployer:ApiToken must be configured.")
    .Validate(options => options.MaxActivePreviews > 0, "Deployer:MaxActivePreviews must be positive.")
    .ValidateOnStart();

builder.Services.AddDbContext<DeployerDbContext>((services, db) =>
    db.UseSqlite($"Data Source={services.GetRequiredService<IOptions<DeployerOptions>>().Value.DatabasePath}"));

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<DeploymentQueue>();
builder.Services.AddScoped<AuditLog>();
builder.Services.AddScoped<ReleaseCoordinator>();
builder.Services.AddScoped<HealthGate>();

builder.Services.AddSingleton<IContainerOrchestrator, DryRunContainerOrchestrator>();
builder.Services.AddSingleton<ISourceControl, DryRunSourceControl>();
builder.Services.AddSingleton<IImageRegistry, DryRunImageRegistry>();
builder.Services.AddSingleton<IBackupService, DryRunBackupService>();
builder.Services.AddSingleton<INotifier, LogNotifier>();
builder.Services.AddHttpClient<IHealthProbe, HttpHealthProbe>(client => client.Timeout = TimeSpan.FromSeconds(5));

builder.Services.AddHostedService<DatabaseInitializer>();
builder.Services.AddHostedService<DeploymentWorker>();
builder.Services.AddHostedService<ReconciliationWorker>();

builder.Services.AddRateLimiter(limiter =>
{
    limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    limiter.AddFixedWindowLimiter("api", window =>
    {
        window.PermitLimit = 60;
        window.Window = TimeSpan.FromMinutes(1);
    });
});
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapDeployerApi();

app.Run();

public partial class Program;
