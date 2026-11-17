using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Usuarios;
using Unmess.Infrastructure.Database;

namespace Unmess.Api.Realtime;

public static class RealtimeRooms
{
    public static string Company(int companyId) => $"company-{companyId}";
    public static string Notification(int companyId) => $"company-{companyId}-notification";
    public static string Status(int companyId, string status) => $"company-{companyId}-status-{status}";
    public static string Ticket(int companyId, string ticketId) => $"company-{companyId}-ticket-{ticketId}";
}

[Authorize]
public sealed class RealtimeHub(
    IUsuarioAtual usuarioAtual,
    PresenceTracker presence,
    IServiceScopeFactory scopeFactory,
    ILogger<RealtimeHub> logger) : Hub
{
    public const string Path = "/socket";

    public override async Task OnConnectedAsync()
    {
        var usuario = usuarioAtual.Obter();
        if (usuario?.EmpresaId is { } empresaId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, RealtimeRooms.Company(empresaId));
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
        var usuario = usuarioAtual.Obter();
        if (usuario?.EmpresaId is { } empresaId && presence.Disconnect(usuario.Id, Context.ConnectionId))
        {
            await SetPresenceAsync(usuario.Id, empresaId, false);
        }

        logger.LogInformation("Client disconnected");
        await base.OnDisconnectedAsync(exception);
    }

    public Task JoinChatBox(string ticketId) =>
        usuarioAtual.Obter()?.EmpresaId is { } empresaId
            ? Groups.AddToGroupAsync(Context.ConnectionId, RealtimeRooms.Ticket(empresaId, ticketId))
            : Task.CompletedTask;

    public Task LeaveChatBox(string ticketId) =>
        usuarioAtual.Obter()?.EmpresaId is { } empresaId
            ? Groups.RemoveFromGroupAsync(Context.ConnectionId, RealtimeRooms.Ticket(empresaId, ticketId))
            : Task.CompletedTask;

    public Task JoinNotification() =>
        usuarioAtual.Obter()?.EmpresaId is { } empresaId
            ? Groups.AddToGroupAsync(Context.ConnectionId, RealtimeRooms.Notification(empresaId))
            : Task.CompletedTask;

    public Task JoinTickets(string status) =>
        usuarioAtual.Obter()?.EmpresaId is { } empresaId
            ? Groups.AddToGroupAsync(Context.ConnectionId, RealtimeRooms.Status(empresaId, status))
            : Task.CompletedTask;

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
