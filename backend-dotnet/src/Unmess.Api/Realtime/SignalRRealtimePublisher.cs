using Microsoft.AspNetCore.SignalR;
using Unmess.Application.Common;

namespace Unmess.Api.Realtime;

public sealed class SignalRRealtimePublisher(IHubContext<RealtimeHub> hub) : IRealtimePublisher
{
    public Task ToCompanyAsync(int companyId, string eventName, object payload, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(RealtimeRooms.Company(companyId)).SendAsync(eventName, payload, cancellationToken);

    public Task ToAllAsync(string eventName, object payload, CancellationToken cancellationToken = default) =>
        hub.Clients.All.SendAsync(eventName, payload, cancellationToken);

    public Task ToGroupAsync(string group, string eventName, object payload, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(group).SendAsync(eventName, payload, cancellationToken);
}
