using System.Net.Mail;

namespace Unmess.Application.Common;

public static class Validation
{
    public static void Required(string? value, string field)
    {
        if (string.IsNullOrEmpty(value))
        {
            throw new AppException($"{field} is a required field");
        }
    }

    public static void MinLength(string? value, string field, int length)
    {
        if (value is not null && value.Length < length)
        {
            throw new AppException($"{field} must be at least {length} characters");
        }
    }

    public static void Email(string? value, string field = "email")
    {
        if (string.IsNullOrEmpty(value))
        {
            return;
        }

        if (!MailAddress.TryCreate(value, out var address) || address.Address != value || !value.Contains('.', StringComparison.Ordinal))
        {
            throw new AppException($"{field} must be a valid email");
        }
    }
}
