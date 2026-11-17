using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Unmess.Domain.Atendimento;
using Unmess.Domain.Conexoes;
using Unmess.Domain.Configuracoes;
using Unmess.Domain.Etiquetas;
using Unmess.Domain.RespostasRapidas;
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
    DbSet<Configuracao> Configuracoes { get; }
    DbSet<Etiqueta> Etiquetas { get; }
    DbSet<RespostaRapida> RespostasRapidas { get; }
    DbSet<SituacaoDeTicket> SituacoesDeTicket { get; }
    DbSet<HorarioDeAtendimento> HorariosDeAtendimento { get; }
    DbSet<Feriado> Feriados { get; }
    DatabaseFacade Database { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
