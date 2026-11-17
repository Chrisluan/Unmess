using Unmess.Application.Mensagens;
using Unmess.Domain.Contatos;
using Unmess.Domain.Filas;
using Unmess.Domain.Tickets;
using Unmess.Domain.Usuarios;

namespace Unmess.Api.Tests;

public sealed class FormatadorDeMensagemTests
{
    private static readonly Contato Maria = new() { Nome = "Maria & Cia", Numero = "5585999990000" };

    [Fact]
    public void Replaces_contact_variables_and_escapes_like_mustache()
    {
        Assert.Equal("Olá Maria &amp; Cia (5585999990000)", FormatadorDeMensagem.Formatar("Olá {{name}} ({{cliente.numero}})", Maria));
    }

    [Fact]
    public void Triple_braces_and_ampersand_do_not_escape()
    {
        Assert.Equal("Maria & Cia / Maria & Cia", FormatadorDeMensagem.Formatar("{{{name}}} / {{& cliente.nome}}", Maria));
    }

    [Fact]
    public void Ticket_variables_include_queue_agent_and_protocol()
    {
        var ticket = new Ticket
        {
            Contato = new Contato { Nome = "João" },
            Fila = new Fila { Nome = "Vendas" },
            Usuario = new Usuario { Nome = "Ana" },
            Protocolo = "20261117000013"
        };

        Assert.Equal("João, setor Vendas, atendente Ana, protocolo 20261117000013.",
            FormatadorDeMensagem.Formatar("{{cliente.nome}}, setor {{setor}}, atendente {{atendente}}, protocolo {{protocolo}}.", ticket));
    }

    [Fact]
    public void Unknown_variables_become_empty()
    {
        Assert.Equal("Oi !", FormatadorDeMensagem.Formatar("Oi {{desconhecida}}!", Maria));
    }

    [Theory]
    [InlineData("pending", 0)]
    [InlineData("sent", 1)]
    [InlineData("delivered", 2)]
    [InlineData("read", 3)]
    [InlineData("played", 4)]
    [InlineData("failed", 0)]
    public void Maps_gateway_status_to_ack(string status, int ack)
    {
        Assert.Equal(ack, AckDaMensagem.DaSituacao(status));
    }
}
