using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Infrastructure.Database;

namespace Unmess.Api.Realtime;

[Authorize]
public sealed class RealtimeHub(
    IUsuarioAtual usuarioAtual,
    PresenceTracker presence,
    RoomMembership membership,
    IServiceScopeFactory scopeFactory,
    ILogger<RealtimeHub> logger) : Hub
{
    public const string Path = "/socket";

    public override async Task OnConnectedAsync()
    {
        var usuario = usuarioAtual.Obter();
        if (usuario?.EmpresaId is { } empresaId)
        {
            await JoinAsync(RealtimeRooms.Company(empresaId));
            if (presence.Connect(usuario.Id, Context.ConnectionId))
            {
                await SetPresenceAsync(usuario.Id, empresaId, true);
            }
        }

        logger.LogInformation("Client connected");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        membership.Disconnect(Context.ConnectionId);
        var usuario = usuarioAtual.Obter();
        if (usuario?.EmpresaId is { } empresaId && presence.Disconnect(usuario.Id, Context.ConnectionId))
        {
            await SetPresenceAsync(usuario.Id, empresaId, false);
        }

        logger.LogInformation("Client disconnected");
        await base.OnDisconnectedAsync(exception);
    }

    public Task JoinChatBox(string ticketId) =>
        usuarioAtual.Obter()?.EmpresaId is { } empresaId ? JoinAsync(RealtimeRooms.Ticket(empresaId, ticketId)) : Task.CompletedTask;

    public async Task LeaveChatBox(string ticketId)
    {
        if (usuarioAtual.Obter()?.EmpresaId is { } empresaId)
        {
            var room = RealtimeRooms.Ticket(empresaId, ticketId);
            membership.Leave(Context.ConnectionId, room);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, room);
        }
    }

    public Task JoinNotification() =>
        usuarioAtual.Obter()?.EmpresaId is { } empresaId ? JoinAsync(RealtimeRooms.Notification(empresaId)) : Task.CompletedTask;

    public Task JoinTickets(string status) =>
        usuarioAtual.Obter()?.EmpresaId is { } empresaId ? JoinAsync(RealtimeRooms.Status(empresaId, status)) : Task.CompletedTask;

    private Task JoinAsync(string room)
    {
        membership.Join(Context.ConnectionId, room);
        return Groups.AddToGroupAsync(Context.ConnectionId, room);
    }

    private async Task SetPresenceAsync(int usuarioId, int empresaId, bool online)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<UnmessDbContext>();
            var clock = scope.ServiceProvider.GetRequiredService<DatabaseClock>();
            var usuario = await db.Usuarios.FirstOrDefaultAsync(item => item.Id == usuarioId);
            if (usuario is not null)
            {
                usuario.Online = online;
                usuario.VistoPorUltimoEm = clock.UtcNow();
                await db.SaveChangesAsync();
            }

            await Clients.Group(RealtimeRooms.Company(empresaId)).SendAsync("userPresence", new { userId = usuarioId, online });
        }
        catch (Exception exception) when (exception is DbUpdateException or InvalidOperationException)
        {
            logger.LogError(exception, "Error updating presence for user {UserId}", usuarioId);
        }
    }
}

public sealed class PresenceTracker
{
    private readonly ConcurrentDictionary<int, HashSet<string>> connections = new();

    public bool Connect(int userId, string connectionId)
    {
        var set = connections.GetOrAdd(userId, _ => []);
        lock (set)
        {
            var wasOffline = set.Count == 0;
            set.Add(connectionId);
            return wasOffline;
        }
    }

    public bool Disconnect(int userId, string connectionId)
    {
        if (!connections.TryGetValue(userId, out var set))
        {
            return false;
        }

        lock (set)
        {
            set.Remove(connectionId);
            if (set.Count > 0)
            {
                return false;
            }

            connections.TryRemove(userId, out _);
            return true;
        }
    }
}
