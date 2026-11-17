using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Unmess.Api.Endpoints;
using Unmess.Api.Tests.Support;

namespace Unmess.Api.Tests;

public sealed class LegacyJwtAuthenticationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static Dictionary<string, object?> NodeBackendClaims() => new()
    {
        ["username"] = "Maria",
        ["profile"] = "admin",
        ["id"] = 42,
        ["companyId"] = 7,
        ["companyName"] = "Empresa Teste"
    };

    [Fact]
    public async Task Accepts_token_issued_with_the_node_backend_shape()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", ApiFactory.CreateLegacyToken(NodeBackendClaims()));

        var response = await client.GetAsync("/internal/whoami");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<WhoAmIEndpoints.WhoAmIResponse>();
        Assert.Equal(new WhoAmIEndpoints.WhoAmIResponse(42, "Maria", "admin", 7, "Empresa Teste"), body);
    }

    [Fact]
    public async Task Accepts_token_without_company()
    {
        var claims = NodeBackendClaims();
        claims["profile"] = "user";
        claims.Remove("companyId");
        claims.Remove("companyName");
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", ApiFactory.CreateLegacyToken(claims));

        var body = await client.GetFromJsonAsync<WhoAmIEndpoints.WhoAmIResponse>("/internal/whoami");

        Assert.Equal(new WhoAmIEndpoints.WhoAmIResponse(42, "Maria", "user", null, null), body);
    }

    [Fact]
    public async Task Rejects_token_signed_with_another_secret()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            ApiFactory.CreateLegacyToken(NodeBackendClaims(), "another-secret-with-enough-length-for-hmac"));

        var response = await client.GetAsync("/internal/whoami");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Rejects_expired_token()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            ApiFactory.CreateLegacyToken(NodeBackendClaims(), expires: DateTime.UtcNow.AddMinutes(-5)));

        var response = await client.GetAsync("/internal/whoami");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Rejects_request_without_token()
    {
        var response = await factory.CreateClient().GetAsync("/internal/whoami");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
