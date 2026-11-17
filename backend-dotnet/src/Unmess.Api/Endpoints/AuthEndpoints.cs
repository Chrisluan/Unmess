using Unmess.Api.Http;
using Unmess.Application.Authentication;
using Unmess.Application.Common;

namespace Unmess.Api.Endpoints;

public static class AuthEndpoints
{
    public const string RefreshCookie = "jrt";

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var auth = endpoints.MapGroup("/auth");

        auth.MapPost("/login", async (LoginRequest request, HttpContext context, SessionService sessions, LoginAttemptLimiter limiter, CancellationToken cancellationToken) =>
        {
            var client = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            if (limiter.IsBlocked(client))
            {
                return Results.Json(new { error = LoginAttemptLimiter.TooManyAttempts }, statusCode: StatusCodes.Status429TooManyRequests);
            }

            try
            {
                var result = await sessions.LoginAsync(request, cancellationToken);
                WriteRefreshCookie(context, result.RefreshToken);
                return Results.Ok(result);
            }
            catch (AppException)
            {
                limiter.RegisterFailure(client);
                throw;
            }
        });

        auth.MapPost("/refresh_token", async (HttpContext context, SessionService sessions, CancellationToken cancellationToken) =>
        {
            try
            {
                var result = await sessions.RefreshAsync(
                    context.Request.Cookies[RefreshCookie],
                    context.Request.Headers.Authorization.ToString(),
                    cancellationToken);
                WriteRefreshCookie(context, result.RefreshToken);
                return Results.Ok(result);
            }
            catch (AppException)
            {
                context.Response.Cookies.Delete(RefreshCookie);
                throw AppException.Unauthorized(ErrorCodes.SessionExpired);
            }
        });

        auth.MapDelete("/logout", (HttpContext context) =>
        {
            context.Response.Cookies.Delete(RefreshCookie);
            return Results.Ok();
        }).RequireAuthorization();

        auth.MapPost("/select-company", async (SelectCompanyRequest request, SessionService sessions, CancellationToken cancellationToken) =>
            Results.Ok(await sessions.SelectCompanyAsync(request, cancellationToken)))
            .RequireAuthorization();

        return endpoints;
    }

    private static void WriteRefreshCookie(HttpContext context, string token)
    {
        var viaHttps = context.Request.IsHttps;
        context.Response.Cookies.Append(RefreshCookie, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = viaHttps,
            SameSite = viaHttps ? SameSiteMode.None : SameSiteMode.Lax,
            Path = "/"
        });
    }
}
