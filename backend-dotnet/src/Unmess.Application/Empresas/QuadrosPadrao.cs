namespace Unmess.Application.Empresas;

public sealed record ModeloDeEtapa(string Nome, string Cor, string Tipo, bool Inicial = false, bool Final = false);

public sealed record ModeloDeQuadro(string Nome, string Cor, IReadOnlyList<ModeloDeEtapa> Etapas);

public static class QuadrosPadrao
{
    public static readonly IReadOnlyList<ModeloDeQuadro> Todos =
    [
        new("Funil de Vendas", "#2576d2",
        [
            new("Novo", "#90a4ae", "open", Inicial: true),
            new("Contato feito", "#42a5f5", "open"),
            new("Proposta enviada", "#ab47bc", "open"),
            new("Negociação", "#ffa726", "open"),
            new("Ganho", "#66bb6a", "open", Final: true),
            new("Perdido", "#ef5350", "lost")
        ]),
        new("Produção", "#ffa726",
        [
            new("Na fila", "#90a4ae", "open", Inicial: true),
            new("Em produção", "#42a5f5", "open"),
            new("Acabamento", "#ab47bc", "open"),
            new("Pronto", "#66bb6a", "open", Final: true)
        ]),
        new("Expedição", "#26a69a",
        [
            new("A separar", "#90a4ae", "open", Inicial: true),
            new("Em rota", "#42a5f5", "open"),
            new("Entregue", "#66bb6a", "open", Final: true)
        ]),
        new("Financeiro", "#66bb6a",
        [
            new("A faturar", "#90a4ae", "open", Inicial: true),
            new("Faturado", "#42a5f5", "open"),
            new("Pago", "#66bb6a", "open", Final: true)
        ])
    ];
}
