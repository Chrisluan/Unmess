namespace Unmess.Application.Common;

public class AppException(string message, int statusCode = 400) : Exception(message)
{
    public int StatusCode { get; } = statusCode;

    public static AppException NotFound(string message) => new(message, 404);
    public static AppException Forbidden(string message = ErrorCodes.NoPermission) => new(message, 403);
    public static AppException Unauthorized(string message) => new(message, 401);
}

public static class ErrorCodes
{
    public const string NoPermission = "ERR_NO_PERMISSION";
    public const string SessionExpired = "ERR_SESSION_EXPIRED";
    public const string InvalidCredentials = "ERR_INVALID_CREDENTIALS";
    public const string CompanyRequired = "Esta ação requer contexto de empresa. O super-admin deve acessar via painel de empresas.";
}
