namespace Unmess.Infrastructure.WhatsappGateway;

public sealed class WhatsappGatewayOptions
{
    public const string SectionName = "WhatsappGateway";

    public string BaseUrl { get; set; } = "http://localhost:8090";
    public string ApiToken { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public TimeSpan SignatureTolerance { get; set; } = TimeSpan.FromMinutes(5);
}
