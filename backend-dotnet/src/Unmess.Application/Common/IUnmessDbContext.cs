using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Unmess.Domain.Atendimento;
using Unmess.Domain.Clientes;
using Unmess.Domain.Conexoes;
using Unmess.Domain.Contatos;
using Unmess.Domain.Figurinhas;
using Unmess.Domain.Mensagens;
using Unmess.Domain.Produtos;
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
    DbSet<Contato> Contatos { get; }
    DbSet<CampoDoContato> CamposDosContatos { get; }
    DbSet<Cliente> Clientes { get; }
    DbSet<Produto> Produtos { get; }
    DbSet<Figurinha> Figurinhas { get; }
    DbSet<Mensagem> Mensagens { get; }
    DatabaseFacade Database { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
