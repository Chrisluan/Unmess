using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Serilog;
using Serilog.Formatting.Compact;
using Unmess.Api.Authentication;
using Unmess.Api.Endpoints;
using Unmess.Api.Health;
using Unmess.Api.Http;
using Unmess.Api.Realtime;
using Unmess.Api.WhatsappGateway;
using Unmess.Application;
using Unmess.Application.Common;
using Unmess.Infrastructure;
using Unmess.Infrastructure.Storage;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSerilog((services, logger) => logger
    .ReadFrom.Configuration(builder.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .WriteTo.Console(new RenderedCompactJsonFormatter()));

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.ConfigureHttpJsonOptions(options => JsonSetup.Configure(options.SerializerOptions));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<LoginAttemptLimiter>();
builder.Services.AddSingleton<PresenceTracker>();
builder.Services.AddSingleton<IRealtimePublisher, SignalRRealtimePublisher>();
builder.Services.AddExceptionHandler<AppExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddLegacyJwtAuthentication();
builder.Services.AddSignalR().AddJsonProtocol(options => JsonSetup.Configure(options.PayloadSerializerOptions));

var allowedOrigins = new AllowedOrigins(builder.Configuration);
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .SetIsOriginAllowed(allowedOrigins.IsAllowed)
    .AllowCredentials()
    .AllowAnyHeader()
    .AllowAnyMethod()));

var requestsPerMinute = builder.Configuration.GetValue("API_RATE_LIMIT", 600);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
        await context.HttpContext.Response.WriteAsJsonAsync(new { error = "ERR_MUITAS_REQUISICOES" }, cancellationToken);
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        context.Request.Path.StartsWithSegments(RealtimeHub.Path) || context.Request.Path.StartsWithSegments("/health")
            ? RateLimitPartition.GetNoLimiter("unlimited")
            : RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = requestsPerMinute, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseSerilogRequestLogging();
app.UseExceptionHandler();
app.UseCors();
app.UseRateLimiter();

var uploads = Path.GetFullPath(app.Services.GetRequiredService<IOptions<UploadOptions>>().Value.Directory);
Directory.CreateDirectory(uploads);
app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(uploads), RequestPath = "/public" });

app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthEndpoints();
app.MapWhoAmIEndpoints();
app.MapGatewayEventsEndpoints();
app.MapAuthEndpoints();
app.MapUsuarioEndpoints();
app.MapGrupoDePermissaoEndpoints();
app.MapEmpresaEndpoints();
app.MapHub<RealtimeHub>(RealtimeHub.Path);

app.Run();

public partial class Program;
