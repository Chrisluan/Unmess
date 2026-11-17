using Microsoft.Extensions.Caching.Memory;

namespace Unmess.Api.Http;

public sealed class LoginAttemptLimiter(IMemoryCache cache, TimeProvider timeProvider)
{
    public const int MaxFailures = 10;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    public const string TooManyAttempts = "ERR_MUITAS_TENTATIVAS_LOGIN";

    private readonly object gate = new();

    public bool IsBlocked(string key)
    {
        lock (gate)
        {
            return Recent(key).Count >= MaxFailures;
        }
    }

    public void RegisterFailure(string key)
    {
        lock (gate)
        {
            var failures = Recent(key);
            failures.Add(timeProvider.GetUtcNow());
            cache.Set(CacheKey(key), failures, Window);
        }
    }

    private List<DateTimeOffset> Recent(string key)
    {
        var limit = timeProvider.GetUtcNow() - Window;
        var failures = cache.Get<List<DateTimeOffset>>(CacheKey(key)) ?? [];
        failures.RemoveAll(moment => moment < limit);
        return failures;
    }

    private static string CacheKey(string key) => $"login-failures:{key}";
}
