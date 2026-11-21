using System.Net;
using System.Net.Http.Json;
using Unmess.Deployer.Api;
using Unmess.Deployer.Tests.Support;

namespace Unmess.Deployer.Tests;

public sealed class ReleaseFlowTests : IDisposable
{
    private readonly DeployerFactory factory = new();

    public void Dispose() => factory.Dispose();

    [Fact]
    public async Task Rejects_unsigned_event()
    {
        var request = DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated("release01", "aaa"), secret: "wrong");

        var response = await factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Rejects_stale_event()
    {
        var request = DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated("release01", "aaa"), at: DateTimeOffset.UtcNow.AddMinutes(-10));

        var response = await factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Ignores_duplicate_delivery()
    {
        var client = factory.CreateClient();

        var first = await client.SendAsync(DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated("release01", "aaa"), "delivery-1"));
        var second = await client.SendAsync(DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated("release01", "aaa"), "delivery-1"));

        Assert.Equal(HttpStatusCode.Accepted, first.StatusCode);
        var body = await second.Content.ReadFromJsonAsync<CommandResponse>();
        Assert.Equal("Duplicate", body?.Status);
    }

    [Fact]
    public async Task Management_api_requires_token()
    {
        var response = await factory.CreateClient().PostAsync("/api/v1/releases/release01/approve", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Ci_event_deploys_preview_and_waits_for_approval()
    {
        await factory.CreateClient().SendAsync(DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated("release01", "aaa")));

        var release = await factory.WaitForStateAsync("release01", "AwaitingApproval");

        Assert.Equal("https://release01.unmess.test", release.PreviewUrl);
        Assert.Contains("preview:release01:sha-aaa", factory.Orchestrator.Calls);
    }

    [Fact]
    public async Task Approval_promotes_same_image_and_removes_preview()
    {
        await factory.CreateClient().SendAsync(DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated("release01", "aaa")));
        await factory.WaitForStateAsync("release01", "AwaitingApproval");
        var client = factory.CreateAuthorizedClient();

        var approval = await client.PostAsync("/api/v1/releases/release01/approve", null);
        var release = await factory.WaitForStateAsync("release01", "Healthy");

        Assert.Equal(HttpStatusCode.Accepted, approval.StatusCode);
        Assert.Equal("v1.1.0", release.Version);
        Assert.Equal(["aaa"], factory.SourceControl.FastForwards);
        Assert.Equal(
            ["preview:release01:sha-aaa", "migrate:v1.1.0", "production:v1.1.0", "remove-preview:release01"],
            factory.Orchestrator.Calls);
        var status = await client.GetFromJsonAsync<ProductionStatusResponse>("/api/v1/production/status");
        Assert.Equal("v1.1.0", status?.CurrentTag);
    }

    [Fact]
    public async Task Approval_is_refused_when_release_does_not_contain_production()
    {
        factory.SourceControl.ProductionSha = "prod";
        factory.SourceControl.ReleasesContainProduction = false;
        await factory.CreateClient().SendAsync(DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated("release01", "aaa")));
        await factory.WaitForStateAsync("release01", "AwaitingApproval");

        var approval = await factory.CreateAuthorizedClient().PostAsync("/api/v1/releases/release01/approve", null);

        Assert.Equal(HttpStatusCode.Conflict, approval.StatusCode);
        Assert.Empty(factory.SourceControl.FastForwards);
    }

    [Fact]
    public async Task Unhealthy_promotion_rolls_back_to_previous_image()
    {
        var client = factory.CreateAuthorizedClient();
        await factory.CreateClient().SendAsync(DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated("release01", "aaa")));
        await factory.WaitForStateAsync("release01", "AwaitingApproval");
        await client.PostAsync("/api/v1/releases/release01/approve", null);
        await factory.WaitForStateAsync("release01", "Healthy");

        factory.HealthProbe.UnhealthyProductionTags.Add("v1.2.0");
        await factory.CreateClient().SendAsync(DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated("release02", "bbb")));
        await factory.WaitForStateAsync("release02", "AwaitingApproval");
        await client.PostAsync("/api/v1/releases/release02/approve", null);
        var release = await factory.WaitForStateAsync("release02", "RolledBack");

        Assert.Contains("rolled back to v1.1.0", release.LastError);
        Assert.Equal("production:v1.1.0", factory.Orchestrator.Calls.Last());
        var status = await client.GetFromJsonAsync<ProductionStatusResponse>("/api/v1/production/status");
        Assert.Equal("v1.1.0", status?.CurrentTag);
    }

    [Fact]
    public async Task Manual_rollback_returns_to_previous_tag()
    {
        var client = factory.CreateAuthorizedClient();
        foreach (var (release, sha) in new[] { ("release01", "aaa"), ("release02", "bbb") })
        {
            await factory.CreateClient().SendAsync(DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated(release, sha)));
            await factory.WaitForStateAsync(release, "AwaitingApproval");
            await client.PostAsync($"/api/v1/releases/{release}/approve", null);
            await factory.WaitForStateAsync(release, "Healthy");
        }

        var rollback = await client.PostAsJsonAsync("/api/v1/production/rollback", new RollbackRequest(null));

        Assert.Equal(HttpStatusCode.Accepted, rollback.StatusCode);
        ProductionStatusResponse? status = null;
        for (var attempt = 0; attempt < 200 && status?.CurrentTag != "v1.1.0"; attempt++)
        {
            await Task.Delay(25);
            status = await client.GetFromJsonAsync<ProductionStatusResponse>("/api/v1/production/status");
        }

        Assert.Equal("v1.1.0", status?.CurrentTag);
    }

    [Fact]
    public async Task Rejecting_discards_release_and_removes_preview()
    {
        await factory.CreateClient().SendAsync(DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated("release01", "aaa")));
        await factory.WaitForStateAsync("release01", "AwaitingApproval");

        var rejection = await factory.CreateAuthorizedClient().PostAsync("/api/v1/releases/release01/reject", null);

        Assert.Equal(HttpStatusCode.Accepted, rejection.StatusCode);
        await factory.WaitForStateAsync("release01", "Discarded");
        Assert.Contains("remove-preview:release01", factory.Orchestrator.Calls);
    }

    [Fact]
    public async Task Audit_records_actions()
    {
        await factory.CreateClient().SendAsync(DeployerFactory.SignedEvent(DeployerFactory.ReleaseUpdated("release01", "aaa")));
        await factory.WaitForStateAsync("release01", "AwaitingApproval");

        var audit = await factory.CreateAuthorizedClient().GetFromJsonAsync<List<AuditEntryResponse>>("/api/v1/audit");

        Assert.Contains(audit!, entry => entry.Action == "release.received" && entry.Target == "release01");
        Assert.Contains(audit!, entry => entry.Action == "preview.ready" && entry.Target == "release01");
    }
}
