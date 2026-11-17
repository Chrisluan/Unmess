using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Unmess.Application.Common;
using Unmess.Domain.Atendimento;
using Unmess.Domain.Comum;
using Unmess.Domain.Configuracoes;
using Unmess.Domain.Etiquetas;
using Unmess.Domain.RespostasRapidas;
using Unmess.Domain.Conexoes;
using Unmess.Domain.Crm;
using Unmess.Domain.Empresas;
using Unmess.Domain.Filas;
using Unmess.Domain.Tickets;
using Unmess.Domain.Usuarios;

namespace Unmess.Infrastructure.Database;

public sealed class UnmessDbContext(DbContextOptions<UnmessDbContext> options, DatabaseClock clock)
    : DbContext(options), IUnmessDbContext
{
    public const string CreatedAtShadow = "CriadoEm";
    public const string UpdatedAtShadow = "AtualizadoEm";

    public DbSet<Empresa> Empresas => Set<Empresa>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<GrupoDePermissao> GruposDePermissao => Set<GrupoDePermissao>();
    public DbSet<Fila> Filas => Set<Fila>();
    public DbSet<ConexaoWhatsapp> ConexoesWhatsapp => Set<ConexaoWhatsapp>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<Quadro> Quadros => Set<Quadro>();
    public DbSet<EtapaDoFunil> EtapasDoFunil => Set<EtapaDoFunil>();
    public DbSet<Configuracao> Configuracoes => Set<Configuracao>();
    public DbSet<Etiqueta> Etiquetas => Set<Etiqueta>();
    public DbSet<RespostaRapida> RespostasRapidas => Set<RespostaRapida>();
    public DbSet<SituacaoDeTicket> SituacoesDeTicket => Set<SituacaoDeTicket>();
    public DbSet<HorarioDeAtendimento> HorariosDeAtendimento => Set<HorarioDeAtendimento>();
    public DbSet<Feriado> Feriados => Set<Feriado>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTimeOffset>().HaveConversion<LocalDateTimeOffsetConverter>().HaveColumnType("datetime");
        configurationBuilder.Properties<DateTimeOffset?>().HaveConversion<LocalDateTimeOffsetConverter>().HaveColumnType("datetime");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Empresa>(entity =>
        {
            Table(entity, "Companies");
            entity.Property(item => item.Nome).HasColumnName("name");
            entity.Property(item => item.Documento).HasColumnName("document");
            entity.Property(item => item.Email).HasColumnName("email");
            entity.Property(item => item.Telefone).HasColumnName("phone");
            entity.Property(item => item.Plano).HasColumnName("plan");
            entity.Property(item => item.Situacao).HasColumnName("status");
            entity.Property(item => item.Vencimento).HasColumnName("dueDate");
            entity.Property(item => item.Logo).HasColumnName("logo");
        });

        modelBuilder.Entity<GrupoDePermissao>(entity =>
        {
            Table(entity, "PermissionGroups");
            entity.Property(item => item.Nome).HasColumnName("name");
            entity.Property(item => item.Permissoes).HasColumnName("permissions");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
        });

        modelBuilder.Entity<Fila>(entity =>
        {
            Table(entity, "Queues");
            entity.Property(item => item.Nome).HasColumnName("name");
            entity.Property(item => item.Cor).HasColumnName("color");
            entity.Property(item => item.MensagemDeSaudacao).HasColumnName("greetingMessage");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
            entity.Property(item => item.Padrao).HasColumnName("isDefault");
        });

        modelBuilder.Entity<ConexaoWhatsapp>(entity =>
        {
            Table(entity, "Whatsapps");
            entity.Property(item => item.Nome).HasColumnName("name");
            entity.Property(item => item.Sessao).HasColumnName("session");
            entity.Property(item => item.QrCode).HasColumnName("qrcode");
            entity.Property(item => item.Situacao).HasColumnName("status");
            entity.Property(item => item.Bateria).HasColumnName("battery");
            entity.Property(item => item.Carregando).HasColumnName("plugged");
            entity.Property(item => item.Padrao).HasColumnName("isDefault");
            entity.Property(item => item.Tentativas).HasColumnName("retries");
            entity.Property(item => item.MensagemDeSaudacao).HasColumnName("greetingMessage");
            entity.Property(item => item.MensagemDeDespedida).HasColumnName("farewellMessage");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
            entity.Property(item => item.Numero).HasColumnName("number");
            entity.HasMany(item => item.Filas).WithMany().UsingEntity("WhatsappQueues",
                right => right.HasOne(typeof(Fila)).WithMany().HasForeignKey("queueId"),
                left => left.HasOne(typeof(ConexaoWhatsapp)).WithMany().HasForeignKey("whatsappId"),
                join => JoinTimestamps(join));
        });

        modelBuilder.Entity<Usuario>(entity =>
        {
            Table(entity, "Users");
            entity.Property(item => item.Nome).HasColumnName("name");
            entity.Property(item => item.Email).HasColumnName("email");
            entity.Property(item => item.HashDaSenha).HasColumnName("passwordHash");
            entity.Property(item => item.Perfil).HasColumnName("profile");
            entity.Property(item => item.VersaoDoToken).HasColumnName("tokenVersion");
            entity.Property(item => item.ConexaoWhatsappId).HasColumnName("whatsappId");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
            entity.Property(item => item.GrupoDePermissaoId).HasColumnName("permissionGroupId");
            entity.Property(item => item.PermissoesPersonalizadas).HasColumnName("customPermissions");
            entity.Property(item => item.Online).HasColumnName("online");
            entity.Property(item => item.MaximoDeTicketsSimultaneos).HasColumnName("maxSimultaneousTickets");
            entity.Property(item => item.VistoPorUltimoEm).HasColumnName("lastSeenAt");
            entity.HasOne(item => item.ConexaoWhatsapp).WithMany().HasForeignKey(item => item.ConexaoWhatsappId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(item => item.Empresa).WithMany().HasForeignKey(item => item.EmpresaId);
            entity.HasOne(item => item.GrupoDePermissao).WithMany().HasForeignKey(item => item.GrupoDePermissaoId).OnDelete(DeleteBehavior.SetNull);
            entity.HasMany(item => item.Filas).WithMany(fila => fila.Usuarios).UsingEntity("UserQueues",
                right => right.HasOne(typeof(Fila)).WithMany().HasForeignKey("queueId"),
                left => left.HasOne(typeof(Usuario)).WithMany().HasForeignKey("userId"),
                join => JoinTimestamps(join));
        });

        modelBuilder.Entity<Ticket>(entity =>
        {
            Table(entity, "Tickets", precision: 6);
            entity.Property(item => item.Situacao).HasColumnName("status");
            entity.Property(item => item.UltimaMensagem).HasColumnName("lastMessage");
            entity.Property(item => item.ContatoId).HasColumnName("contactId");
            entity.Property(item => item.UsuarioId).HasColumnName("userId");
            entity.Property(item => item.ConexaoWhatsappId).HasColumnName("whatsappId");
            entity.Property(item => item.EhGrupo).HasColumnName("isGroup");
            entity.Property(item => item.MensagensNaoLidas).HasColumnName("unreadMessages");
            entity.Property(item => item.FilaId).HasColumnName("queueId");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
            entity.Property(item => item.SituacaoDeEncerramentoId).HasColumnName("closingStatusId");
            entity.Property(item => item.PrimeiraRespostaEm).HasColumnName("firstResponseAt");
            entity.Property(item => item.EncerradoEm).HasColumnName("closedAt");
            entity.Property(item => item.Protocolo).HasColumnName("protocol");
            entity.Property(item => item.SaudacaoEnviada).HasColumnName("greetingSent");
            entity.Property(item => item.UltimaMensagemEm).HasColumnName("lastMessageAt");
        });

        modelBuilder.Entity<Configuracao>(entity =>
        {
            Table(entity, "Settings");
            entity.Property(item => item.Chave).HasColumnName("key");
            entity.Property(item => item.Valor).HasColumnName("value");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
        });

        modelBuilder.Entity<Etiqueta>(entity =>
        {
            Table(entity, "Tags");
            entity.Property(item => item.Nome).HasColumnName("name");
            entity.Property(item => item.Cor).HasColumnName("color");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
        });

        modelBuilder.Entity<RespostaRapida>(entity =>
        {
            Table(entity, "QuickAnswers");
            entity.Property(item => item.Atalho).HasColumnName("shortcut");
            entity.Property(item => item.Mensagem).HasColumnName("message");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
        });

        modelBuilder.Entity<SituacaoDeTicket>(entity =>
        {
            Table(entity, "TicketStatuses");
            entity.Property(item => item.Nome).HasColumnName("name");
            entity.Property(item => item.Cor).HasColumnName("color");
            entity.Property(item => item.Tipo).HasColumnName("type");
            entity.Property(item => item.Padrao).HasColumnName("isDefault");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
        });

        modelBuilder.Entity<HorarioDeAtendimento>(entity =>
        {
            Table(entity, "BusinessHours");
            entity.Property(item => item.DiaDaSemana).HasColumnName("weekDay");
            entity.Property(item => item.Ativo).HasColumnName("enabled");
            entity.Property(item => item.Inicio).HasColumnName("startTime");
            entity.Property(item => item.Fim).HasColumnName("endTime");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
        });

        modelBuilder.Entity<Feriado>(entity =>
        {
            Table(entity, "Holidays");
            entity.Property(item => item.Nome).HasColumnName("name");
            entity.Property(item => item.Data).HasColumnName("date").HasColumnType("date")
                .HasConversion(value => value.ToDateTime(TimeOnly.MinValue), value => DateOnly.FromDateTime(value));
            entity.Property(item => item.Recorrente).HasColumnName("recurring");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
        });

        modelBuilder.Entity<Quadro>(entity =>
        {
            Table(entity, "Boards");
            entity.Property(item => item.Nome).HasColumnName("name");
            entity.Property(item => item.Cor).HasColumnName("color");
            entity.Property(item => item.Ordem).HasColumnName("order");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
            entity.Property(item => item.EhFunilDeVendas).HasColumnName("isSalesFunnel");
            entity.HasMany(item => item.Etapas).WithOne().HasForeignKey(etapa => etapa.QuadroId);
        });

        modelBuilder.Entity<EtapaDoFunil>(entity =>
        {
            Table(entity, "PipelineStages");
            entity.Property(item => item.Nome).HasColumnName("name");
            entity.Property(item => item.Cor).HasColumnName("color");
            entity.Property(item => item.Ordem).HasColumnName("order");
            entity.Property(item => item.Tipo).HasColumnName("type");
            entity.Property(item => item.EmpresaId).HasColumnName("companyId");
            entity.Property(item => item.QuadroId).HasColumnName("boardId");
            entity.Property(item => item.EhFinal).HasColumnName("isFinal");
            entity.Property(item => item.EhInicial).HasColumnName("isInitial");
            entity.Property(item => item.QuadroDestinoId).HasColumnName("targetBoardId");
            entity.Property(item => item.EtapaDestinoId).HasColumnName("targetStageId");
            entity.Property(item => item.Probabilidade).HasColumnName("probability");
            entity.Property(item => item.EhGanho).HasColumnName("isWon");
            entity.Property(item => item.Ativa).HasColumnName("active");
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = clock.UtcNow();
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is IRegistroComDatas registro)
            {
                if (entry.State == EntityState.Added)
                {
                    registro.CriadoEm = now;
                    registro.AtualizadoEm = now;
                }
                else if (entry.State == EntityState.Modified)
                {
                    registro.AtualizadoEm = now;
                }
            }
            else if (entry.State == EntityState.Added && entry.Metadata.FindProperty(CreatedAtShadow) is not null)
            {
                entry.Property(CreatedAtShadow).CurrentValue = now;
                entry.Property(UpdatedAtShadow).CurrentValue = now;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }

    private static void Table<T>(EntityTypeBuilder<T> entity, string table, int? precision = null) where T : Entidade
    {
        entity.ToTable(table);
        entity.HasKey(item => item.Id);
        entity.Property(item => item.Id).HasColumnName("id");
        var createdAt = entity.Property(item => item.CriadoEm).HasColumnName("createdAt");
        var updatedAt = entity.Property(item => item.AtualizadoEm).HasColumnName("updatedAt");
        if (precision is { } value)
        {
            createdAt.HasColumnType($"datetime({value})");
            updatedAt.HasColumnType($"datetime({value})");
        }
    }

    private static void JoinTimestamps(EntityTypeBuilder join)
    {
        join.Property<DateTimeOffset>(CreatedAtShadow).HasColumnName("createdAt");
        join.Property<DateTimeOffset>(UpdatedAtShadow).HasColumnName("updatedAt");
    }
}

public sealed class LocalDateTimeOffsetConverter() : ValueConverter<DateTimeOffset, DateTime>(
    value => value.ToOffset(DatabaseClock.Offset).DateTime,
    value => new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Unspecified), DatabaseClock.Offset).ToUniversalTime());
