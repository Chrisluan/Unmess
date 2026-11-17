using Unmess.Deployer.Events;

namespace Unmess.Deployer.Tests;

public sealed class EventSignatureTests
{
    private const string Secret = "secret";
    private const string Body = """{"type":"release.updated"}""";
    private static readonly DateTimeOffset Now = DateTimeOffset.FromUnixTimeSeconds(1_800_000_000);
    private static readonly TimeSpan Tolerance = TimeSpan.FromMinutes(5);

    private static string Timestamp(DateTimeOffset at) => at.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);

    [Fact]
    public void Accepts_matching_signature()
    {
        var signature = EventSignature.Compute(Secret, Now.ToUnixTimeSeconds(), Body);

        Assert.Equal(SignatureCheck.Valid, EventSignature.Verify(Secret, Timestamp(Now), signature, Body, Now, Tolerance));
    }

    [Fact]
    public void Rejects_signature_from_another_secret()
    {
        var signature = EventSignature.Compute("other", Now.ToUnixTimeSeconds(), Body);

        Assert.Equal(SignatureCheck.Mismatch, EventSignature.Verify(Secret, Timestamp(Now), signature, Body, Now, Tolerance));
    }

    [Fact]
    public void Rejects_tampered_body()
    {
        var signature = EventSignature.Compute(Secret, Now.ToUnixTimeSeconds(), Body);

        Assert.Equal(SignatureCheck.Mismatch, EventSignature.Verify(Secret, Timestamp(Now), signature, Body + " ", Now, Tolerance));
    }

    [Fact]
    public void Rejects_replayed_old_request()
    {
        var sentAt = Now.AddMinutes(-6);
        var signature = EventSignature.Compute(Secret, sentAt.ToUnixTimeSeconds(), Body);

        Assert.Equal(SignatureCheck.Stale, EventSignature.Verify(Secret, Timestamp(sentAt), signature, Body, Now, Tolerance));
    }

    [Theory]
    [InlineData(null, "sha256=00")]
    [InlineData("1800000000", null)]
    [InlineData("not-a-number", "sha256=00")]
    public void Rejects_missing_headers(string? timestamp, string? signature)
    {
        Assert.Equal(SignatureCheck.Missing, EventSignature.Verify(Secret, timestamp, signature, Body, Now, Tolerance));
    }
}
