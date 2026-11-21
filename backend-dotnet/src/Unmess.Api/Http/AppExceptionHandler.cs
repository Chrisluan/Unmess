using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Unmess.Application.Common;

namespace Unmess.Api.Http;

public sealed class AppExceptionHandler(ILogger<AppExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        switch (exception)
        {
            case AppException appException:
                logger.LogWarning("{StatusCode} {Message}", appException.StatusCode, appException.Message);
                httpContext.Response.StatusCode = appException.StatusCode;
                await httpContext.Response.WriteAsJsonAsync(new { error = appException.Message }, cancellationToken);
                return true;
            case BadHttpRequestException or JsonException:
                httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
                await httpContext.Response.WriteAsJsonAsync(new { error = "Invalid request body" }, cancellationToken);
                return true;
            default:
                logger.LogError(exception, "Unhandled exception");
                httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await httpContext.Response.WriteAsJsonAsync(new { error = "Internal server error" }, cancellationToken);
                return true;
        }
    }
}
