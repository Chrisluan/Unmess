using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Domain.Atendimento;

namespace Unmess.Application.Atendimento;

public sealed record HorarioResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("weekDay")] int DiaDaSemana,
    [property: JsonPropertyName("enabled")] bool Ativo,
    [property: JsonPropertyName("startTime")] string? Inicio,
    [property: JsonPropertyName("endTime")] string? Fim,
    [property: JsonPropertyName("companyId")] int EmpresaId,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm)
{
    public static HorarioResposta De(HorarioDeAtendimento horario) => new(
        horario.Id, horario.DiaDaSemana, horario.Ativo, horario.Inicio, horario.Fim, horario.EmpresaId, horario.CriadoEm, horario.AtualizadoEm);
}

public sealed record DiaDeAtendimento
{
    [JsonPropertyName("weekDay")] public int DiaDaSemana { get; init; }
    [JsonPropertyName("enabled")] public bool? Ativo { get; init; }
    [JsonPropertyName("startTime")] public string? Inicio { get; init; }
    [JsonPropertyName("endTime")] public string? Fim { get; init; }
}

public sealed record DadosDosHorarios
{
    [JsonPropertyName("days")] public List<DiaDeAtendimento>? Dias { get; init; }
}

public sealed record FeriadoResposta(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Nome,
    [property: JsonPropertyName("date")] string Data,
    [property: JsonPropertyName("recurring")] bool Recorrente,
    [property: JsonPropertyName("companyId")] int EmpresaId,
    [property: JsonPropertyName("createdAt")] DateTimeOffset CriadoEm,
    [property: JsonPropertyName("updatedAt")] DateTimeOffset AtualizadoEm)
{
    public static FeriadoResposta De(Feriado feriado) => new(
        feriado.Id, feriado.Nome, feriado.Data.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), feriado.Recorrente, feriado.EmpresaId, feriado.CriadoEm, feriado.AtualizadoEm);
}

public sealed record DadosDoFeriado
{
    [JsonPropertyName("name")] public string? Nome { get; init; }
    [JsonPropertyName("date")] public string? Data { get; init; }
    [JsonPropertyName("recurring")] public bool? Recorrente { get; init; }
}

public sealed class HorarioDeAtendimentoService(IUnmessDbContext db, IUsuarioAtual usuarioAtual)
{
    public const string ErroFeriadoInvalido = "ERR_INVALID_HOLIDAY";
    public const string ErroFeriadoDuplicado = "ERR_DUPLICATED_HOLIDAY";
    public const string ErroFeriadoNaoEncontrado = "ERR_NO_HOLIDAY_FOUND";

    public async Task<IReadOnlyList<HorarioResposta>> ListarHorariosAsync(CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        return await HorariosAsync(empresaId, cancellationToken);
    }

    public async Task<IReadOnlyList<HorarioResposta>> SalvarHorariosAsync(DadosDosHorarios dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var existentes = await db.HorariosDeAtendimento.Where(item => item.EmpresaId == empresaId).ToListAsync(cancellationToken);
        foreach (var dia in dados.Dias ?? [])
        {
            var horario = existentes.FirstOrDefault(item => item.DiaDaSemana == dia.DiaDaSemana);
            if (horario is null)
            {
                horario = new HorarioDeAtendimento { DiaDaSemana = dia.DiaDaSemana, EmpresaId = empresaId };
                db.HorariosDeAtendimento.Add(horario);
                existentes.Add(horario);
            }

            if (dia.Ativo is not null) horario.Ativo = dia.Ativo.Value;
            if (dia.Inicio is not null) horario.Inicio = dia.Inicio;
            if (dia.Fim is not null) horario.Fim = dia.Fim;
        }

        await db.SaveChangesAsync(cancellationToken);
        return await HorariosAsync(empresaId, cancellationToken);
    }

    public async Task<IReadOnlyList<FeriadoResposta>> ListarFeriadosAsync(CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var feriados = await db.Feriados.AsNoTracking().Where(item => item.EmpresaId == empresaId).OrderBy(item => item.Data).ToListAsync(cancellationToken);
        return feriados.Select(FeriadoResposta.De).ToList();
    }

    public async Task<FeriadoResposta> CriarFeriadoAsync(DadosDoFeriado dados, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        if (string.IsNullOrWhiteSpace(dados.Nome) || string.IsNullOrEmpty(dados.Data) ||
            !DateOnly.TryParse(dados.Data.Length >= 10 ? dados.Data[..10] : dados.Data, CultureInfo.InvariantCulture, out var data))
        {
            throw new AppException(ErroFeriadoInvalido);
        }
        if (await db.Feriados.AnyAsync(item => item.EmpresaId == empresaId && item.Data == data, cancellationToken))
        {
            throw new AppException(ErroFeriadoDuplicado);
        }

        var feriado = new Feriado { Nome = dados.Nome.Trim(), Data = data, Recorrente = dados.Recorrente ?? false, EmpresaId = empresaId };
        db.Feriados.Add(feriado);
        await db.SaveChangesAsync(cancellationToken);
        return FeriadoResposta.De(feriado);
    }

    public async Task RemoverFeriadoAsync(int id, CancellationToken cancellationToken)
    {
        var empresaId = usuarioAtual.EmpresaIdObrigatoria();
        var feriado = await db.Feriados.FirstOrDefaultAsync(item => item.Id == id && item.EmpresaId == empresaId, cancellationToken)
                      ?? throw AppException.NotFound(ErroFeriadoNaoEncontrado);
        db.Feriados.Remove(feriado);
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<HorarioResposta>> HorariosAsync(int empresaId, CancellationToken cancellationToken)
    {
        var horarios = await db.HorariosDeAtendimento.AsNoTracking().Where(item => item.EmpresaId == empresaId).OrderBy(item => item.DiaDaSemana).ToListAsync(cancellationToken);
        return horarios.Select(HorarioResposta.De).ToList();
    }
}
