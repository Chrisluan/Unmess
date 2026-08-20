# Publica a instalacao em app.unmess.com.br e api.unmess.com.br.
#
# Pre-requisito que este script NAO resolve: o dominio precisa estar com os
# nameservers da Cloudflare. O tunel nomeado cria um CNAME apontando para
# cfargotunnel.com, e esse endereco so resolve pelo DNS da Cloudflare -- com o
# DNS do Registro.br o nome simplesmente nao existe para o mundo.
#
# Uso (PowerShell como Administrador):
#   cd C:\unmess
#   .\scripts\publicar-dominio.ps1
#   .\scripts\publicar-dominio.ps1 -Dominio outro.com.br
#   .\scripts\publicar-dominio.ps1 -Remover

param(
    [string]$Dominio = "unmess.com.br",
    [string]$NomeTunel = "unmess",
    [switch]$Remover
)

$ErrorActionPreference = "Stop"

# O cloudflared escreve o progresso no stderr mesmo quando da certo. No
# PowerShell 5.1, redirecionar stderr de executavel nativo (2>&1) embrulha
# cada linha num erro e, com ErrorActionPreference Stop, aborta o script no
# meio -- foi o que interrompeu a publicacao logo apos criar o primeiro
# CNAME. Por isso nenhuma chamada ao cloudflared usa 2>&1 aqui.
$cf = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$configDir = "$env:USERPROFILE\.cloudflared"
$configFile = "$configDir\config.yml"

function Escrever($t, $c = "Gray") { Write-Host $t -ForegroundColor $c }

$app = "app.$Dominio"
$api = "api.$Dominio"

Escrever ""
Escrever "  Publicacao em dominio proprio" "Cyan"
Escrever "  -----------------------------" "Cyan"
Escrever ""

if (-not (Test-Path $cf)) { Escrever "  cloudflared nao encontrado em $cf" "Red"; exit 1 }

$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $admin) { Escrever "  Precisa rodar como Administrador (o tunel vira servico)." "Red"; exit 1 }

if ($Remover) {
    Escrever "  Removendo o servico e o tunel..." "Yellow"
    try { & $cf service uninstall | Out-Null } catch {}
    try { & $cf tunnel delete -f $NomeTunel | Out-Null } catch {}
    Escrever "  Removido. O acesso pelo Tailscale continua valendo." "Green"
    exit 0
}

# --- 1. checagem do DNS ------------------------------------------------------
#
# Falhar aqui, com a explicacao, e melhor que criar o tunel e deixar o usuario
# olhando um endereco que nunca vai responder.

Escrever "  Conferindo os nameservers de $Dominio..." "Yellow"
$ns = (Resolve-DnsName -Name $Dominio -Type NS -ErrorAction SilentlyContinue | Where-Object { $_.NameHost }).NameHost

if (-not $ns) {
    Escrever "  Nao consegui consultar os nameservers. Verifique a conexao." "Red"
    exit 1
}

Escrever "  Nameservers atuais: $($ns -join ', ')" "Gray"

if (-not ($ns -match "cloudflare")) {
    Escrever ""
    Escrever "  O dominio ainda nao esta na Cloudflare." "Red"
    Escrever ""
    Escrever "  O tunel cria um CNAME para cfargotunnel.com, que so resolve pelo DNS" "Gray"
    Escrever "  da Cloudflare. Com o DNS do Registro.br o endereco nao existe." "Gray"
    Escrever ""
    Escrever "  O que fazer (uma vez so):" "Cyan"
    Escrever "   1. Crie uma conta gratuita em cloudflare.com" "Gray"
    Escrever "   2. Add a site -> $Dominio -> plano Free" "Gray"
    Escrever "   3. A Cloudflare mostra dois nameservers (algo.ns.cloudflare.com)" "Gray"
    Escrever "   4. No registro.br, painel do dominio -> alterar servidores DNS," "Gray"
    Escrever "      troque de 'DNS automatico' para os dois da Cloudflare" "Gray"
    Escrever "   5. Espere propagar (minutos a algumas horas) e rode este script de novo" "Gray"
    Escrever ""
    Escrever "  Ate la nada muda: o acesso pelo Tailscale continua funcionando." "Green"
    Escrever ""
    exit 1
}

Escrever "  Dominio na Cloudflare." "Green"

# --- 2. login ----------------------------------------------------------------

if (-not (Get-ChildItem $configDir -Filter *.pem -ErrorAction SilentlyContinue)) {
    Escrever ""
    Escrever "  Falta autorizar esta maquina na sua conta Cloudflare." "Yellow"
    Escrever "  Vai abrir o navegador; escolha o dominio $Dominio e autorize." "Gray"
    Escrever ""
    & $cf tunnel login
    if ($LASTEXITCODE -ne 0) { Escrever "  Login nao concluido." "Red"; exit 1 }
}

# --- 3. tunel ----------------------------------------------------------------

$existente = & $cf tunnel list | Select-String -Pattern "\s$NomeTunel\s"

if (-not $existente) {
    Escrever "  Criando o tunel '$NomeTunel'..." "Yellow"
    & $cf tunnel create $NomeTunel
    if ($LASTEXITCODE -ne 0) { Escrever "  Falha ao criar o tunel." "Red"; exit 1 }
} else {
    Escrever "  Tunel '$NomeTunel' ja existe." "Gray"
}

$idTunel = ((& $cf tunnel list | Select-String -Pattern "\s$NomeTunel\s") -split '\s+')[0]
$credencial = "$configDir\$idTunel.json"

# --- 4. configuracao ---------------------------------------------------------
#
# Os dois nomes vao para o mesmo tunel, cada um para uma porta local. E o mesmo
# desenho que o Tailscale usava (443 -> interface, 8443 -> API), com a diferenca
# de que aqui os dois saem na 443 com nomes diferentes -- e por isso o navegador
# os trata como o mesmo site, o que dispensa o SameSite=None no cookie.

$config = @"
tunnel: $idTunel
credentials-file: $credencial

ingress:
  - hostname: $app
    service: http://localhost:3333
  - hostname: $api
    service: http://localhost:8080
  # Regra final obrigatoria: o que nao casar acima recebe 404 em vez de vazar
  # para outro servico da maquina.
  - service: http_status:404
"@

# WriteAllText grava sem BOM; Set-Content -Encoding utf8 no PS 5.1 sempre
# adiciona, e um YAML com BOM depende da boa vontade do parser.
[IO.File]::WriteAllText($configFile, $config)
Escrever "  Configuracao gravada em $configFile" "Green"

# --- 5. DNS ------------------------------------------------------------------

Escrever "  Apontando $app e $api para o tunel..." "Yellow"
# Cada CNAME num try proprio: se um ja existir, o outro ainda e criado.
foreach ($nome in @($app, $api)) {
    try {
        & $cf tunnel route dns --overwrite-dns $NomeTunel $nome | Out-Null
        Escrever "  DNS de $nome apontado." "Green"
    } catch {
        Escrever "  DNS de ${nome}: $($_.Exception.Message)" "Yellow"
    }
}
Escrever "  DNS configurado." "Green"

# --- 6. servico --------------------------------------------------------------

Escrever "  Instalando o tunel como servico do Windows..." "Yellow"
try { & $cf service uninstall | Out-Null } catch {}
& $cf service install
Start-Sleep -Seconds 4

$svc = Get-Service Cloudflared -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne "Running") { Start-Service Cloudflared }

Escrever "  Servico: $((Get-Service Cloudflared -ErrorAction SilentlyContinue).Status)" "Green"

# --- 7. aplicacao ------------------------------------------------------------
#
# O frontend descobre a API pelo endereco publico gravado aqui, e o backend so
# aceita requisicoes de origens declaradas. Sem estes dois passos o site abre e
# o login falha por CORS.

$enderecoPublico = @"
{
  "VITE_PUBLIC_APP_HOST": "$app",
  "VITE_PUBLIC_API_URL": "https://$api",
  "VITE_HOURS_CLOSE_TICKETS_AUTO": null,
  "atualizadoEm": "$( (Get-Date).ToString('o') )"
}
"@
[IO.File]::WriteAllText("C:\unmess\frontend\endereco-publico.json", $enderecoPublico)
Escrever "  Endereco publico do frontend atualizado." "Green"

$envPath = "C:\unmess\backend\.env"
$envTexto = Get-Content $envPath -Raw
$origens = "https://$app"
if ($envTexto -match '(?m)^PUBLIC_ORIGINS=(.*)$') {
    $atuais = $matches[1] -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    $novas = @($atuais + $origens | Select-Object -Unique) -join ','
    $envTexto = $envTexto -replace '(?m)^PUBLIC_ORIGINS=.*$', "PUBLIC_ORIGINS=$novas"
} else {
    $envTexto += "`r`nPUBLIC_ORIGINS=$origens"
}
[IO.File]::WriteAllText($envPath, $envTexto)
Escrever "  CORS do backend atualizado." "Green"

Escrever ""
Escrever "  Reiniciando os servicos..." "Yellow"
Restart-Service unmess-backend
Restart-Service unmess-frontend

Escrever ""
Escrever "  Pronto:" "Cyan"
Escrever "    Interface : https://$app" "Green"
Escrever "    API       : https://$api" "Green"
Escrever ""
Escrever "  O certificado HTTPS e emitido pela Cloudflare, sem nada a instalar." "Gray"
Escrever "  O Tailscale continua valendo como caminho reserva." "Gray"
Escrever ""
