<#
.SINOPSE
    Registra o UPU como serviço do Windows, para que ele suba com a máquina.

.DESCRICAO
    Precisa de Administrador, por dois motivos que valem saber: registrar um
    serviço é operação de sistema, e o UPU reinicia os serviços do unmess —
    coisa que uma conta comum não faz.

    O serviço roda como LocalSystem. É o mesmo nível dos serviços que ele
    controla, e é o que faz a atualização funcionar de madrugada, sem ninguém
    logado na máquina.

    Um detalhe que já causou confusão em máquina parecida: o git precisa
    conseguir autenticar como LocalSystem. Se a branch de produção for de um
    repositório privado que autentica pelo gerenciador de credenciais do seu
    usuário, o serviço não vai enxergar essa credencial. O caminho é usar
    HTTPS com token no remote, ou deixar o repositório público para leitura.

.EXEMPLO
    .\scripts\instalar-upu.ps1
    .\scripts\instalar-upu.ps1 -Remover
#>
[CmdletBinding()]
param(
    [string]$Nome = "unmess-upu",
    [string]$Publicacao,
    [switch]$Remover
)

$ErrorActionPreference = "Stop"

$souAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $souAdmin) {
    Write-Host ""
    Write-Host "  Este script precisa de um PowerShell como Administrador." -ForegroundColor Red
    Write-Host "  (registrar serviço e reiniciar serviço não são operações de conta comum)"
    Write-Host ""
    exit 1
}

$raizDoUpu = Split-Path -Parent $PSScriptRoot
if (-not $Publicacao) { $Publicacao = Join-Path $raizDoUpu "publicacao" }

$executavel = Join-Path $Publicacao "Upu.Server.exe"

# ------------------------------------------------------------------- remover

if ($Remover) {
    $servico = Get-Service -Name $Nome -ErrorAction SilentlyContinue

    if (-not $servico) {
        Write-Host "  O serviço $Nome não está instalado."
        exit 0
    }

    if ($servico.Status -ne "Stopped") {
        Write-Host "  Parando ${Nome}…"
        Stop-Service -Name $Nome -Force
        $servico.WaitForStatus("Stopped", (New-TimeSpan -Seconds 30))
    }

    # sc.exe delete em vez de Remove-Service para funcionar igual no Windows
    # Server mais antigo, onde o cmdlet não existe.
    & sc.exe delete $Nome | Out-Null

    Write-Host "  Serviço $Nome removido." -ForegroundColor Green
    Write-Host "  Os dados em $(Join-Path $raizDoUpu 'dados') continuam onde estavam."
    exit 0
}

# ----------------------------------------------------------------- instalar

if (-not (Test-Path $executavel)) {
    Write-Host ""
    Write-Host "  Não achei $executavel" -ForegroundColor Red
    Write-Host "  Compile antes:  .\scripts\compilar.ps1" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

$jaExiste = Get-Service -Name $Nome -ErrorAction SilentlyContinue

if ($jaExiste) {
    Write-Host "  O serviço $Nome já existe; parando para atualizar o binário…"

    if ($jaExiste.Status -ne "Stopped") {
        Stop-Service -Name $Nome -Force
        $jaExiste.WaitForStatus("Stopped", (New-TimeSpan -Seconds 30))
    }

    & sc.exe delete $Nome | Out-Null

    # O Gerenciador de Serviços leva um instante para soltar o nome; criar de
    # novo antes disso falha com "serviço marcado para exclusão".
    $tentativas = 0
    while ((Get-Service -Name $Nome -ErrorAction SilentlyContinue) -and $tentativas -lt 20) {
        Start-Sleep -Milliseconds 500
        $tentativas++
    }
}

New-Service `
    -Name $Nome `
    -BinaryPathName "`"$executavel`"" `
    -DisplayName "Unmess Production Updater" `
    -Description "Aplica as atualizações da branch de produção no horário programado e avisa os usuários." `
    -StartupType Automatic | Out-Null

# Recuperação automática: se o UPU morrer, ele volta. Um vigia que não volta
# sozinho é um vigia que some na primeira noite ruim.
& sc.exe failure $Nome reset= 86400 actions= restart/30000/restart/60000/restart/120000 | Out-Null

Start-Service -Name $Nome

$servico = Get-Service -Name $Nome
$servico.WaitForStatus("Running", (New-TimeSpan -Seconds 30))

Write-Host ""
Write-Host "  Serviço $Nome no ar." -ForegroundColor Green
Write-Host "  Painel: http://127.0.0.1:8091"
Write-Host ""
Write-Host "  Na primeira vez, o painel pede para criar a senha."
Write-Host "  O diário fica em C:\unmess\logs\upu.log"
Write-Host ""
