namespace Unmess.Deployer;

public sealed class DeployerOptions
{
    public const string SectionName = "Deployer";

    public string DatabasePath { get; set; } = "deployer.db";
    public string WebhookSecret { get; set; } = string.Empty;
    public string ApiToken { get; set; } = string.Empty;
    public string PreviewUrlTemplate { get; set; } = "https://{release}.example.com";
    public string ProductionUrl { get; set; } = "https://app.example.com";
    public int MaxActivePreviews { get; set; } = 3;
    public int MajorVersion { get; set; } = 1;
    public int KeptProductionImages { get; set; } = 5;
    public TimeSpan SignatureTolerance { get; set; } = TimeSpan.FromMinutes(5);
    public TimeSpan HealthCheckWindow { get; set; } = TimeSpan.FromSeconds(60);
    public TimeSpan HealthCheckInterval { get; set; } = TimeSpan.FromSeconds(5);
    public int RequiredHealthyChecks { get; set; } = 3;
    public TimeSpan ReconciliationInterval { get; set; } = TimeSpan.FromMinutes(5);

    public string PreviewUrlFor(string release) => PreviewUrlTemplate.Replace("{release}", release, StringComparison.Ordinal);
}
