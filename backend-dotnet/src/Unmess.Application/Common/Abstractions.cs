namespace Unmess.Application.Common;

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface IRealtimePublisher
{
    Task ToCompanyAsync(int companyId, string eventName, object payload, CancellationToken cancellationToken = default);
    Task ToAllAsync(string eventName, object payload, CancellationToken cancellationToken = default);
    Task ToGroupAsync(string group, string eventName, object payload, CancellationToken cancellationToken = default);
}

public sealed record Paged<T>(IReadOnlyList<T> Items, int Count, bool HasMore);

public static class Paging
{
    public const int PageSize = 20;

    public static int Offset(string? pageNumber, int pageSize = PageSize) =>
        pageSize * (Math.Max(1, int.TryParse(pageNumber, out var page) ? page : 1) - 1);
}
