using Microsoft.EntityFrameworkCore;

namespace Unmess.Deployer.Data;

public sealed class DeployerDbContext(DbContextOptions<DeployerDbContext> options) : DbContext(options)
{
    public DbSet<Release> Releases => Set<Release>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();
    public DbSet<ProductionDeployment> ProductionDeployments => Set<ProductionDeployment>();
    public DbSet<ProcessedDelivery> ProcessedDeliveries => Set<ProcessedDelivery>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Release>(entity =>
        {
            entity.HasKey(release => release.Name);
            entity.Property(release => release.State).HasConversion<string>();
            entity.Property(release => release.CreatedAt).HasConversion<long>(
                value => value.ToUnixTimeMilliseconds(),
                value => DateTimeOffset.FromUnixTimeMilliseconds(value));
            entity.Property(release => release.UpdatedAt).HasConversion<long>(
                value => value.ToUnixTimeMilliseconds(),
                value => DateTimeOffset.FromUnixTimeMilliseconds(value));
        });

        modelBuilder.Entity<AuditEntry>(entity =>
        {
            entity.Property(entry => entry.At).HasConversion<long>(
                value => value.ToUnixTimeMilliseconds(),
                value => DateTimeOffset.FromUnixTimeMilliseconds(value));
            entity.HasIndex(entry => entry.At);
        });

        modelBuilder.Entity<ProductionDeployment>(entity =>
        {
            entity.Property(deployment => deployment.DeployedAt).HasConversion<long>(
                value => value.ToUnixTimeMilliseconds(),
                value => DateTimeOffset.FromUnixTimeMilliseconds(value));
            entity.HasIndex(deployment => deployment.Tag);
        });

        modelBuilder.Entity<ProcessedDelivery>(entity =>
        {
            entity.HasKey(delivery => delivery.Id);
            entity.Property(delivery => delivery.ReceivedAt).HasConversion<long>(
                value => value.ToUnixTimeMilliseconds(),
                value => DateTimeOffset.FromUnixTimeMilliseconds(value));
        });
    }
}
