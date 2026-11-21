namespace Unmess.Infrastructure.Database;

public sealed class DatabaseClock(TimeProvider timeProvider)
{
    public static TimeSpan Offset { get; set; } = TimeSpan.FromHours(-3);

    public DateTimeOffset UtcNow()
    {
        var now = timeProvider.GetUtcNow();
        return new DateTimeOffset(now.Ticks - now.Ticks % TimeSpan.TicksPerMillisecond, TimeSpan.Zero);
    }
}
