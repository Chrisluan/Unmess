using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Unmess.Application.WhatsappGateway;

namespace Unmess.Infrastructure.WhatsappGateway;

public sealed class WhatsappGatewayClient(HttpClient httpClient, IOptions<WhatsappGatewayOptions> options) : IWhatsappGateway
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public Task<GatewaySession> GetSessionAsync(string sessionId, CancellationToken cancellationToken) =>
        SendAsync<GatewaySession>(HttpMethod.Get, $"v1/sessions/{Uri.EscapeDataString(sessionId)}", null, cancellationToken);

    public Task<GatewaySession> ConnectAsync(string sessionId, CancellationToken cancellationToken) =>
        SendAsync<GatewaySession>(HttpMethod.Post, $"v1/sessions/{Uri.EscapeDataString(sessionId)}/connect", null, cancellationToken);

    public Task<GatewaySession> DisconnectAsync(string sessionId, bool logout, CancellationToken cancellationToken) =>
        SendAsync<GatewaySession>(HttpMethod.Post, $"v1/sessions/{Uri.EscapeDataString(sessionId)}/disconnect", new { logout }, cancellationToken);

    public Task<GatewaySendResult> SendAsync(string sessionId, GatewaySendCommand command, CancellationToken cancellationToken) =>
        SendAsync<GatewaySendResult>(HttpMethod.Post, $"v1/sessions/{Uri.EscapeDataString(sessionId)}/messages", command, cancellationToken);

    private async Task<T> SendAsync<T>(HttpMethod method, string path, object? body, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, new Uri(new Uri(options.Value.BaseUrl.TrimEnd('/') + "/"), path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Value.ApiToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body, options: Json);
        }

        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(Json, cancellationToken)
               ?? throw new InvalidOperationException($"Gateway returned an empty body for {path}.");
    }
}
