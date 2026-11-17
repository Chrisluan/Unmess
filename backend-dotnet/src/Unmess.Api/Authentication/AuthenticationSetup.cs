using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Unmess.Api.Realtime;
using Unmess.Application.Common;
using Unmess.Application.Usuarios;
using Unmess.Infrastructure.Security;

namespace Unmess.Api.Authentication;

public static class AuthenticationSetup
{
    public const string InvalidTokenMessage = "Invalid token. We'll try to assign a new one on next request";

    public static IServiceCollection AddLegacyJwtAuthentication(this IServiceCollection services)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();

        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtOptions>>((bearer, jwt) =>
            {
                bearer.MapInboundClaims = false;
                bearer.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Value.Secret)),
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                    NameClaimType = LegacyJwtClaims.Username,
                    RoleClaimType = LegacyJwtClaims.Profile,
                    ClockSkew = TimeSpan.Zero
                };
                bearer.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        if (context.HttpContext.Request.Path.StartsWithSegments(RealtimeHub.Path) &&
                            context.Request.Query.TryGetValue("access_token", out var token))
                        {
                            context.Token = token;
                        }
                        return Task.CompletedTask;
                    },
                    OnChallenge = async context =>
                    {
                        context.HandleResponse();
                        var hasToken = context.Request.Headers.Authorization.Count > 0;
                        context.Response.StatusCode = hasToken ? StatusCodes.Status403Forbidden : StatusCodes.Status401Unauthorized;
                        await context.Response.WriteAsJsonAsync(new { error = hasToken ? InvalidTokenMessage : ErrorCodes.SessionExpired });
                    },
                    OnForbidden = async context =>
                    {
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        await context.Response.WriteAsJsonAsync(new { error = ErrorCodes.NoPermission });
                    }
                };
            });

        services.AddAuthorization();
        services.AddHttpContextAccessor();
        services.AddScoped<IUsuarioAtual, UsuarioAtualDoToken>();

        return services;
    }
}
