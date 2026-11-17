using System.Net;
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
        SendAsync<GatewaySession>(HttpMethod.Get, sessionId, Session(sessionId), null, cancellationToken);

    public Task<GatewaySession> ConnectAsync(string sessionId, CancellationToken cancellationToken) =>
        SendAsync<GatewaySession>(HttpMethod.Post, sessionId, $"{Session(sessionId)}/connect", null, cancellationToken);

    public Task<GatewaySession> DisconnectAsync(string sessionId, bool logout, CancellationToken cancellationToken) =>
        SendAsync<GatewaySession>(HttpMethod.Post, sessionId, $"{Session(sessionId)}/disconnect", new { logout }, cancellationToken);

    public Task<GatewaySendResult> SendAsync(string sessionId, GatewaySendCommand command, CancellationToken cancellationToken) =>
        SendAsync<GatewaySendResult>(HttpMethod.Post, sessionId, $"{Session(sessionId)}/messages", command, cancellationToken);

    public Task<GatewayNumberCheck> CheckNumberAsync(string sessionId, string number, CancellationToken cancellationToken) =>
        SendAsync<GatewayNumberCheck>(HttpMethod.Get, sessionId, $"{Session(sessionId)}/numbers/{Uri.EscapeDataString(number)}", null, cancellationToken);

    public async Task<string?> GetProfilePictureAsync(string sessionId, string jid, CancellationToken cancellationToken) =>
        (await SendAsync<ProfilePicture>(HttpMethod.Get, sessionId, $"{Session(sessionId)}/profile-picture?jid={Uri.EscapeDataString(jid)}", null, cancellationToken)).Url;

    public async Task<IReadOnlyList<GatewayPhoneContact>> ListContactsAsync(string sessionId, CancellationToken cancellationToken) =>
        await SendAsync<List<GatewayPhoneContact>>(HttpMethod.Get, sessionId, $"{Session(sessionId)}/contacts", null, cancellationToken);

    private static string Session(string sessionId) => $"v1/sessions/{Uri.EscapeDataString(sessionId)}";

    private async Task<T> SendAsync<T>(HttpMethod method, string sessionId, string path, object? body, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, new Uri(new Uri(options.Value.BaseUrl.TrimEnd('/') + "/"), path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Value.ApiToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body, options: Json);
        }

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Conflict)
        {
            throw new GatewaySessionUnavailableException(sessionId);
        }

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(Json, cancellationToken)
               ?? throw new InvalidOperationException($"Gateway returned an empty body for {path}.");
    }

    private sealed record ProfilePicture(string? Url);
}
