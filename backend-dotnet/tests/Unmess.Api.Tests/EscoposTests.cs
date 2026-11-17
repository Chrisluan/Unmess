using Unmess.Application.Permissoes;

namespace Unmess.Api.Tests;

public sealed class EscoposTests
{
    private const string Cargo = """{"connection":{"ids":[1,2]},"board":{"todos":true}}""";

    [Fact]
    public void Cargo_com_ids_alcanca_so_os_ids()
    {
        var escopo = Escopos.Resolver(Cargo, null, Escopos.Conexao);

        Assert.False(escopo.Irrestrito);
        Assert.True(escopo.Alcanca(1));
        Assert.False(escopo.Alcanca(3));
    }

    [Fact]
    public void Sem_escopo_definido_nega_tudo_mas_ticket_sem_conexao_passa()
    {
        var escopo = Escopos.Resolver(null, null, Escopos.Conexao);

        Assert.False(escopo.Alcanca(1));
        Assert.True(escopo.Alcanca(null));
    }

    [Fact]
    public void Dimensao_ausente_no_cargo_nega()
    {
        var escopo = Escopos.Resolver("""{"board":{"todos":true}}""", null, Escopos.Conexao);

        Assert.False(escopo.Alcanca(1));
    }

    [Fact]
    public void Todos_e_irrestrito_e_sem_restricao_quando_nao_ha_negados()
    {
        var escopo = Escopos.Resolver(Cargo, null, Escopos.Quadro);

        Assert.True(escopo.Irrestrito);
        Assert.True(escopo.SemRestricao);
        Assert.True(escopo.Alcanca(99));
    }

    [Fact]
    public void Excecao_libera_e_bloqueia_por_cima_do_cargo()
    {
        var excecoes = """{"connection":{"allow":[5],"deny":[2]}}""";
        var escopo = Escopos.Resolver(Cargo, excecoes, Escopos.Conexao);

        Assert.True(escopo.Alcanca(1));
        Assert.True(escopo.Alcanca(5));
        Assert.False(escopo.Alcanca(2));
    }

    [Fact]
    public void Negado_vale_ate_para_irrestrito()
    {
        var escopo = Escopos.Resolver(Cargo, """{"board":{"deny":[7]}}""", Escopos.Quadro);

        Assert.True(escopo.Irrestrito);
        Assert.False(escopo.SemRestricao);
        Assert.False(escopo.Alcanca(7));
        Assert.True(escopo.Alcanca(8));
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("[1,2]")]
    [InlineData("""{"connection":"x"}""")]
    [InlineData("""{"connection":{"ids":"x"}}""")]
    public void Escopo_corrompido_nao_lanca_e_nega(string cru)
    {
        var escopo = Escopos.Resolver(cru, cru, Escopos.Conexao);

        Assert.False(escopo.Alcanca(1));
    }

    [Fact]
    public void Ids_invalidos_sao_descartados_e_strings_numericas_aceitas()
    {
        var escopo = Escopos.Resolver("""{"connection":{"ids":[0,-1,"4",1.5,"a"]}}""", null, Escopos.Conexao);

        Assert.Equal([4], escopo.Ids);
    }

    [Fact]
    public void Escopo_total_do_super_alcanca_tudo()
    {
        Assert.True(EscopoResolvido.Total.Alcanca(123));
        Assert.False(EscopoResolvido.Nenhum.Alcanca(123));
    }
}
