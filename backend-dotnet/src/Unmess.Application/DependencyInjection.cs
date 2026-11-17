using Microsoft.Extensions.DependencyInjection;
using Unmess.Application.Atendimento;
using Unmess.Application.Authentication;
using Unmess.Application.Clientes;
using Unmess.Application.Conexoes;
using Unmess.Application.Configuracoes;
using Unmess.Application.Contatos;
using Unmess.Application.Figurinhas;
using Unmess.Application.Mensagens;
using Unmess.Application.Tickets;
using Unmess.Application.WhatsappGateway;
using Unmess.Application.Produtos;
using Unmess.Application.Etiquetas;
using Unmess.Application.Filas;
using Unmess.Application.RespostasRapidas;
using Unmess.Application.Empresas;
using Unmess.Application.Permissoes;
using Unmess.Application.Usuarios;

namespace Unmess.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ResolvedorDePermissoes>();
        services.AddScoped<SessionService>();
        services.AddScoped<UsuarioService>();
        services.AddScoped<GrupoDePermissaoService>();
        services.AddScoped<EmpresaService>();
        services.AddScoped<LeitorDeConfiguracoes>();
        services.AddScoped<ConfiguracaoService>();
        services.AddScoped<FilaService>();
        services.AddScoped<EtiquetaService>();
        services.AddScoped<RespostaRapidaService>();
        services.AddScoped<SituacaoDeTicketService>();
        services.AddScoped<HorarioDeAtendimentoService>();
        services.AddScoped<SeletorDeConexao>();
        services.AddScoped<ContatoService>();
        services.AddScoped<ClienteService>();
        services.AddScoped<ProdutoService>();
        services.AddScoped<FigurinhaService>();
        services.AddScoped<RegistroDeContatos>();
        services.AddScoped<RegistroDeMensagens>();
        services.AddScoped<EnvioPeloWhatsapp>();
        services.AddScoped<TicketService>();
        services.AddScoped<AberturaDeTickets>();
        services.AddScoped<MensagemService>();
        services.AddScoped<MensagensDoSistema>();
        services.AddScoped<HorarioDeFuncionamento>();
        services.AddScoped<RecebimentoDeMensagens>();
        services.AddScoped<ConexaoService>();
        services.AddScoped<EncerramentoDeInativos>();
        services.AddScoped<IGatewayEventHandler, TratadorDeEventosDoGateway>();
        services.AddHostedService<TarefasEmSegundoPlano>();
        return services;
    }
}
