# Faz o servidor acompanhar a branch `production` sozinho.
#
# Registra uma tarefa do Windows que roda o atualizar-producao.js de tempos em
# tempos. A partir dai, publicar no GitHub e o suficiente: o servidor busca,
# compila, migra e reinicia -- e volta atras sozinho se algo nao subir.
#
# Roda como SYSTEM porque reiniciar servico exige privilegio, e porque assim a
# atualizacao acontece mesmo sem ninguem logado na maquina.
#
# Uso (PowerShell como Administrador):
#   cd C:\unmess
#   .\scripts\instalar-atualizacao-automatica.ps1                 # a cada 10 min
#   .\scripts\instalar-atualizacao-automatica.ps1 -Minutos 30
#   .\scripts\instalar-atualizacao-automatica.ps1 -Remover

param(
    [int]$Minutos = 10,
    [switch]$Remover
)

$ErrorActionPreference = "Stop"
$NomeTarefa = "Unmess - Atualizacao automatica"

function Escrever($t, $c = "Gray") { Write-Host $t -ForegroundColor $c }

Escrever ""
Escrever "  Atualizacao automatica a partir do GitHub" "Cyan"
Escrever "  -----------------------------------------" "Cyan"
Escrever ""

$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $admin) {
    Escrever "  Precisa rodar como Administrador." "Red"
    Escrever "  A tarefa reinicia servicos, o que exige privilegio." "Gray"
    exit 1
}

if ($Remover) {
    $existente = Get-ScheduledTask -TaskName $NomeTarefa -ErrorAction SilentlyContinue
    if ($existente) {
        Unregister-ScheduledTask -TaskName $NomeTarefa -Confirm:$false
        Escrever "  Tarefa removida. O servidor nao se atualiza mais sozinho." "Green"
    } else {
        Escrever "  Nao havia tarefa registrada." "Gray"
    }
    Escrever ""
    exit 0
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = "C:\Program Files\nodejs\node.exe" }
if (-not (Test-Path $node)) { Escrever "  Node nao encontrado." "Red"; exit 1 }

$script = "C:\unmess\scripts\atualizar-producao.js"
if (-not (Test-Path $script)) { Escrever "  Nao encontrei $script" "Red"; exit 1 }

# Se ja existir, e substituida: rodar o instalador de novo e a forma de mudar o
# intervalo, sem precisar remover antes.
$existente = Get-ScheduledTask -TaskName $NomeTarefa -ErrorAction SilentlyContinue
if ($existente) {
    Unregister-ScheduledTask -TaskName $NomeTarefa -Confirm:$false
    Escrever "  Tarefa anterior substituida." "Yellow"
}

$acao = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory "C:\unmess"

# Comeca 2 minutos depois de instalada e repete indefinidamente. O gatilho de
# inicializacao cobre o caso de a maquina ter passado a noite desligada.
$gatilhoIntervalo = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
    -RepetitionInterval (New-TimeSpan -Minutes $Minutos)
$gatilhoBoot = New-ScheduledTaskTrigger -AtStartup

$config = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName $NomeTarefa `
    -Action $acao `
    -Trigger @($gatilhoIntervalo, $gatilhoBoot) `
    -Settings $config `
    -User "SYSTEM" `
    -RunLevel Highest `
    -Description "Acompanha a branch production do GitHub e atualiza a instalacao. Volta atras sozinho se o servico nao subir." | Out-Null

Escrever "  Tarefa registrada." "Green"
Escrever ""
Escrever "  Verifica a cada $Minutos minutos, e tambem ao ligar a maquina." "Gray"
Escrever "  Registro das atualizacoes: C:\unmess\logs\atualizacao.log" "Gray"
Escrever ""
Escrever "  A partir de agora, para publicar uma mudanca:" "Cyan"
Escrever "    git push origin production" "Gray"
Escrever ""
Escrever "  Para rodar agora, sem esperar:" "Cyan"
Escrever "    Start-ScheduledTask -TaskName '$NomeTarefa'" "Gray"
Escrever ""
Escrever "  Para desligar:" "Cyan"
Escrever "    .\scripts\instalar-atualizacao-automatica.ps1 -Remover" "Gray"
Escrever ""
