FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /source

COPY Directory.Build.props Unmess.slnx ./
COPY src/Unmess.Api/Unmess.Api.csproj src/Unmess.Api/
COPY src/Unmess.Application/Unmess.Application.csproj src/Unmess.Application/
COPY src/Unmess.Domain/Unmess.Domain.csproj src/Unmess.Domain/
COPY src/Unmess.Infrastructure/Unmess.Infrastructure.csproj src/Unmess.Infrastructure/
RUN dotnet restore src/Unmess.Api/Unmess.Api.csproj

COPY src/ src/
RUN dotnet publish src/Unmess.Api/Unmess.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
RUN apk add --no-cache icu-libs tzdata
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false \
    ASPNETCORE_HTTP_PORTS=8080 \
    TZ=America/Fortaleza
WORKDIR /app
COPY --from=build /app .
USER app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/health/live || exit 1
ENTRYPOINT ["dotnet", "Unmess.Api.dll"]
