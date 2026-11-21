using System.Collections.Concurrent;

namespace Unmess.Api.Realtime;

public sealed class RoomMembership
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> rooms = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> connections = new();

    public void Join(string connectionId, string room)
    {
        rooms.GetOrAdd(room, _ => new()).TryAdd(connectionId, 0);
        connections.GetOrAdd(connectionId, _ => new()).TryAdd(room, 0);
    }

    public void Leave(string connectionId, string room)
    {
        if (rooms.TryGetValue(room, out var members))
        {
            members.TryRemove(connectionId, out _);
        }
        if (connections.TryGetValue(connectionId, out var joined))
        {
            joined.TryRemove(room, out _);
        }
    }

    public void Disconnect(string connectionId)
    {
        if (!connections.TryRemove(connectionId, out var joined))
        {
            return;
        }

        foreach (var room in joined.Keys)
        {
            if (rooms.TryGetValue(room, out var members))
            {
                members.TryRemove(connectionId, out _);
            }
        }
    }

    public IReadOnlyList<string> ConnectionsIn(IEnumerable<string> roomNames) =>
        roomNames
            .SelectMany(room => rooms.TryGetValue(room, out var members) ? members.Keys : Enumerable.Empty<string>())
            .Distinct()
            .ToList();
}
