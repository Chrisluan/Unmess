using System.Text.RegularExpressions;
using Unmess.Domain.Contatos;
using Unmess.Domain.Tickets;

namespace Unmess.Application.Mensagens;

public static partial class FormatadorDeMensagem
{
    [GeneratedRegex(@"\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*&\s*([\w.]+)\s*\}\}|\{\{\s*([\w.]+)\s*\}\}")]
    private static partial Regex Marcador();

    public static string Formatar(string corpo, Ticket ticket) =>
        Renderizar(corpo, ticket.Contato, ticket.Fila?.Nome, ticket.Usuario?.Nome, ticket.Protocolo);

    public static string Formatar(string corpo, Contato? contato) =>
        Renderizar(corpo, contato, null, null, null);

    private static string Renderizar(string corpo, Contato? contato, string? setor, string? atendente, string? protocolo)
    {
        var valores = new Dictionary<string, string>
        {
            ["name"] = contato?.Nome ?? string.Empty,
            ["cliente.nome"] = contato?.Nome ?? string.Empty,
            ["cliente.numero"] = contato?.Numero ?? string.Empty,
            ["setor"] = setor ?? string.Empty,
            ["atendente"] = atendente ?? string.Empty,
            ["protocolo"] = protocolo ?? string.Empty
        };

        return Marcador().Replace(corpo, encontrado =>
        {
            if (encontrado.Groups[1].Success)
            {
                return valores.GetValueOrDefault(encontrado.Groups[1].Value, string.Empty);
            }
            if (encontrado.Groups[2].Success)
            {
                return valores.GetValueOrDefault(encontrado.Groups[2].Value, string.Empty);
            }
            return EscaparComoMustache(valores.GetValueOrDefault(encontrado.Groups[3].Value, string.Empty));
        });
    }

    private static string EscaparComoMustache(string valor)
    {
        var resultado = new System.Text.StringBuilder(valor.Length);
        foreach (var caractere in valor)
        {
            resultado.Append(caractere switch
            {
                '&' => "&amp;",
                '<' => "&lt;",
                '>' => "&gt;",
                '"' => "&quot;",
                '\'' => "&#39;",
                '/' => "&#x2F;",
                '`' => "&#x60;",
                '=' => "&#x3D;",
                _ => caractere.ToString()
            });
        }
        return resultado.ToString();
    }
}
