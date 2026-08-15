# Lançador do painel de operação do Unmess.
#
# Precisa rodar como Administrador: ligar e desligar serviço do Windows é
# operação privilegiada, e sem isso os botões do painel voltariam "Acesso
# negado" só na hora do aperto.
#
# Uso (PowerShell como Administrador):
#   cd C:\unmess\painel
#   .\painel.ps1
#
# Parâmetros:
#   -Porta       porta de escuta (padrão 8090)
#   -TrocarSenha redefine a senha e sai

param(
    [int]$Porta = 8090,
    [switch]$TrocarSenha
)

$ErrorActionPreference = "Stop"
$raiz = $PSScriptRoot
$config = Join-Path $raiz "config.json"

function Escrever($texto, $cor = "Gray") { Write-Host $texto -ForegroundColor $cor }

Escrever ""
Escrever "  Painel Unmess" "Cyan"
Escrever "  ---------------------------------------" "Cyan"
Escrever ""

# --- privilégios ------------------------------------------------------------

$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $admin) {
    Escrever "  Este script precisa de privilégios de Administrador." "Red"
    Escrever "  Feche esta janela e abra o PowerShell com 'Executar como administrador'." "Red"
    Escrever ""
    exit 1
}

# --- node -------------------------------------------------------------------

$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node) {
    Escrever "  Node não encontrado no PATH." "Red"
    exit 1
}

# --- senha ------------------------------------------------------------------

$precisaSenha = $TrocarSenha -or (-not (Test-Path $config))

if ($precisaSenha) {
    if ($TrocarSenha) {
        Escrever "  Redefinindo a senha do painel." "Yellow"
    } else {
        Escrever "  Primeira execução: defina a senha de acesso ao painel." "Yellow"
        Escrever "  Ela protege os botões de ligar e desligar a produção." "Gray"
    }
    Escrever "  Mínimo de 8 caracteres." "Gray"
    Escrever ""

    $senha1 = Read-Host "  Senha" -AsSecureString
    $senha2 = Read-Host "  Repita a senha" -AsSecureString

    # SecureString existe para a senha não ficar em texto na memória do
    # PowerShell mais tempo que o necessário; a conversão acontece só aqui, e a
    # variável é apagada logo abaixo.
    $texto1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($senha1))
    $texto2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($senha2))

    if ($texto1 -ne $texto2) {
        Escrever ""
        Escrever "  As senhas não conferem." "Red"
        exit 1
    }

    if ($texto1.Length -lt 8) {
        Escrever ""
        Escrever "  A senha precisa ter pelo menos 8 caracteres." "Red"
        exit 1
    }

    # A senha vai pelo stdin: como argumento de linha de comando ela apareceria
    # para qualquer processo que listasse a linha de comando do node.
    $texto1 | & node (Join-Path $raiz "server.js") --definir-senha
    $codigo = $LASTEXITCODE

    Remove-Variable texto1, texto2 -ErrorAction SilentlyContinue
    [GC]::Collect()

    if ($codigo -ne 0) {
        Escrever "  Falha ao gravar a senha." "Red"
        exit 1
    }

    Escrever ""
    Escrever "  Senha definida." "Green"

    if ($TrocarSenha) {
        Escrever ""
        exit 0
    }
    Escrever ""
}

# --- firewall ---------------------------------------------------------------
#
# O painel só é alcançável dos outros computadores se a porta estiver liberada.
# A regra não é criada em silêncio: mexer no firewall de um servidor é decisão
# de quem administra a máquina, não do script.

$nomeRegra = "Unmess-Painel"
$regra = Get-NetFirewallRule -DisplayName $nomeRegra -ErrorAction SilentlyContinue

if (-not $regra) {
    Escrever "  A porta $Porta não está liberada no firewall do Windows." "Yellow"
    Escrever "  Sem a regra, o painel abre só nesta máquina (localhost)." "Gray"
    $resposta = Read-Host "  Criar a regra de firewall para a rede local? (s/N)"

    if ($resposta -eq "s" -or $resposta -eq "S") {
        New-NetFirewallRule -DisplayName $nomeRegra -Direction Inbound -Action Allow `
            -Protocol TCP -LocalPort $Porta -Profile Private | Out-Null
        Escrever "  Regra criada (perfil Private: vale na rede do escritório, não em redes públicas)." "Green"
    } else {
        Escrever "  Seguindo sem a regra. Acesse por http://localhost:$Porta nesta máquina." "Gray"
    }
    Escrever ""
}

# --- subir ------------------------------------------------------------------

$env:PAINEL_PORT = $Porta

Escrever "  Iniciando… (Ctrl+C encerra o painel; os serviços continuam rodando)" "Gray"

& node (Join-Path $raiz "server.js")
