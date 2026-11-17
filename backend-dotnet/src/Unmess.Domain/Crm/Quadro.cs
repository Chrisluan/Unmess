using Unmess.Domain.Comum;

namespace Unmess.Domain.Crm;

public sealed class Quadro : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string Cor { get; set; } = "#2576d2";
    public int Ordem { get; set; }
    public int EmpresaId { get; set; }
    public bool EhFunilDeVendas { get; set; }
    public List<EtapaDoFunil> Etapas { get; set; } = [];
}

public sealed class EtapaDoFunil : Entidade
{
    public string Nome { get; set; } = string.Empty;
    public string Cor { get; set; } = "#2576d2";
    public int Ordem { get; set; }
    public string Tipo { get; set; } = "open";
    public int EmpresaId { get; set; }
    public int? QuadroId { get; set; }
    public bool EhFinal { get; set; }
    public bool EhInicial { get; set; }
    public int? QuadroDestinoId { get; set; }
    public int? EtapaDestinoId { get; set; }
    public int Probabilidade { get; set; }
    public bool EhGanho { get; set; }
    public bool Ativa { get; set; } = true;
}
