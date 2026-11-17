namespace Unmess.Domain.Comum;

public abstract class Entidade : IRegistroComDatas
{
    public int Id { get; set; }
    public DateTimeOffset CriadoEm { get; set; }
    public DateTimeOffset AtualizadoEm { get; set; }
}

public interface IRegistroComDatas
{
    DateTimeOffset CriadoEm { get; set; }
    DateTimeOffset AtualizadoEm { get; set; }
}
