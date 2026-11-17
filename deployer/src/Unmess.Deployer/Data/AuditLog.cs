namespace Unmess.Deployer.Data;

public sealed class AuditLog(DeployerDbContext db, TimeProvider timeProvider)
{
    public async Task WriteAsync(string actor, string action, string? target, string? details, CancellationToken cancellationToken)
    {
        db.AuditEntries.Add(new AuditEntry
        {
            At = timeProvider.GetUtcNow(),
            Actor = actor,
            Action = action,
            Target = target,
            Details = details
        });
        await db.SaveChangesAsync(cancellationToken);
    }
}
