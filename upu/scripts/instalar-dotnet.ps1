<#
.SINOPSE
    Instala o .NET SDK 8 no perfil do usuário, sem precisar de Administrador.

.DESCRICAO
    Esta máquina não tem o .NET, e a sessão que compila o UPU não tem privilégio
    de Administrador. O instalador oficial da Microsoft (dotnet-install.ps1)
    resolve os dois problemas: instala em ~\.dotnet, que é uma pasta do próprio
    usuário, e não mexe em nada do sistema.

    O que ele faz, para você saber antes de rodar:
      1. baixa https://dot.net/v1/dotnet-install.ps1 (script oficial da Microsoft)
      2. roda esse script, que baixa o SDK 8 de https://builds.dotnet.microsoft.com
      3. descompacta em %USERPROFILE%\.dotnet
      4. acrescenta essa pasta ao PATH do usuário

    Desinstalar é apagar a pasta ~\.dotnet e tirar a entrada do PATH.

.EXEMPLO
    .\scripts\instalar-dotnet.ps1
#>
[CmdletBinding()]
param(
    [string]$Canal = "8.0"
)

$ErrorActionPreference = "Stop"

$destino = Join-Path $env:USERPROFILE ".dotnet"
$instalador = Join-Path $env:TEMP "dotnet-install.ps1"

if (Test-Path (Join-Path $destino "dotnet.exe")) {
    Write-Host "  Já existe um .NET em $destino" -ForegroundColor Green
    & (Join-Path $destino "dotnet.exe") --list-sdks
    exit 0
}

Write-Host "  Baixando o instalador oficial da Microsoft…"
Invoke-WebRequest -Uri "https://dot.net/v1/dotnet-install.ps1" -OutFile $instalador -UseBasicParsing

Write-Host "  Instalando o SDK $Canal em ${destino}…"
& $instalador -Channel $Canal -InstallDir $destino -NoPath

if (-not (Test-Path (Join-Path $destino "dotnet.exe"))) {
    Write-Host "  A instalação não deixou o dotnet.exe no lugar esperado." -ForegroundColor Red
    exit 1
}

# PATH do usuário, não o da máquina: o da máquina exigiria Administrador, e
# mudá-lo afetaria os serviços que já estão rodando aqui.
$caminhoAtual = [Environment]::GetEnvironmentVariable("Path", "User")

if ($caminhoAtual -notlike "*$destino*") {
    [Environment]::SetEnvironmentVariable("Path", "$caminhoAtual;$destino", "User")
    Write-Host "  PATH do usuário atualizado (vale nos terminais novos)."
}

$env:Path = "$env:Path;$destino"

Write-Host ""
Write-Host "  Pronto." -ForegroundColor Green
& (Join-Path $destino "dotnet.exe") --list-sdks
Write-Host ""
Write-Host "  Agora: .\scripts\compilar.ps1" -ForegroundColor Cyan
