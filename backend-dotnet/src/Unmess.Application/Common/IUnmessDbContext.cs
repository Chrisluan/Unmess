using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Unmess.Domain.Conexoes;
using Unmess.Domain.Crm;
using Unmess.Domain.Empresas;
using Unmess.Domain.Filas;
using Unmess.Domain.Tickets;
using Unmess.Domain.Usuarios;

namespace Unmess.Application.Common;

public interface IUnmessDbContext
{
    DbSet<Empresa> Empresas { get; }
    DbSet<Usuario> Usuarios { get; }
    DbSet<GrupoDePermissao> GruposDePermissao { get; }
    DbSet<Fila> Filas { get; }
    DbSet<ConexaoWhatsapp> ConexoesWhatsapp { get; }
    DbSet<Ticket> Tickets { get; }
    DbSet<Quadro> Quadros { get; }
    DbSet<EtapaDoFunil> EtapasDoFunil { get; }
    DatabaseFacade Database { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
