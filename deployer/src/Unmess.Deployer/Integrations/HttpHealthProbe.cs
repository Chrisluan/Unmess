namespace Unmess.Deployer.Integrations;

public sealed class HttpHealthProbe(HttpClient httpClient, ILogger<HttpHealthProbe> logger) : IHealthProbe
{
    public async Task<bool> IsHealthyAsync(string baseUrl, CancellationToken cancellationToken)
    {
        try
        {
            using var response = await httpClient.GetAsync($"{baseUrl.TrimEnd('/')}/health/ready", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "Health probe failed for {BaseUrl}", baseUrl);
            return false;
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Health probe timed out for {BaseUrl}", baseUrl);
            return false;
        }
    }
}
