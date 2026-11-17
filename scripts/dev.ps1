[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("setup", "up", "dev", "migrate", "seed", "test", "down", "status", "reset", "help")]
    [string]$Command = "help",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root ".env"
$ComposeFile = Join-Path $Root "deploy\compose.dev.yaml"

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Warn([string]$Message) { Write-Host "AVISO: $Message" -ForegroundColor Yellow }

function New-Secret([int]$Bytes = 32, [switch]$Hex) {
    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    if ($Hex) { return -join ($buffer | ForEach-Object { $_.ToString("x2") }) }
    return [Convert]::ToBase64String($buffer).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Read-DotEnv([string]$Path) {
    $values = @{}
    foreach ($line in Get-Content -Path $Path -Encoding UTF8) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $values[$Matches[1]] = $Matches[2]
        }
    }
    return $values
}

function Write-Utf8([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-Config {
    if (-not (Test-Path $EnvFile)) { throw "Arquivo .env nao encontrado. Rode: .\scripts\dev.ps1 setup" }
    return Read-DotEnv $EnvFile
}

function Assert-Development($Config) {
    if ($Config["APP_ENV"] -ne "development") {
        throw "APP_ENV precisa ser 'development' para este comando. Valor atual: '$($Config["APP_ENV"])'."
    }
    if (@("127.0.0.1", "localhost", "mysql") -notcontains $Config["DB_HOST"]) {
        throw "DB_HOST '$($Config["DB_HOST"])' nao e o banco local de dev. Comando recusado para proteger outros bancos."
    }
}

function Test-Tool([string]$Name) { return [bool](Get-Command $Name -ErrorAction SilentlyContinue) }

function Assert-Docker {
    if (-not (Test-Tool "docker")) {
        throw "Comando 'docker' nao encontrado. Instale o Docker Desktop (com WSL2) e abra-o antes de rodar este comando."
    }
    Invoke-In "." { docker info --format "{{.ServerVersion}}" *> $null }
}

function Invoke-Compose([string[]]$Arguments) {
    Assert-Docker
    Invoke-In "." { docker compose --env-file $EnvFile -f $ComposeFile @Arguments }
}

function Invoke-In([string]$Directory, [scriptblock]$Block) {
    Push-Location (Join-Path $Root $Directory)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $global:LASTEXITCODE = 0
        & $Block
        if ($LASTEXITCODE -ne 0) { throw "Falhou em $Directory (codigo $LASTEXITCODE)." }
    }
    finally {
        $ErrorActionPreference = $previous
        Pop-Location
    }
}

function Write-AppEnvFiles($Config) {
    $backendEnv = Join-Path $Root "backend\.env.localhost"
    $frontendEnv = Join-Path $Root "frontend\.env.localhost"

    if ($Force -or -not (Test-Path $backendEnv)) {
        Write-Utf8 $backendEnv (@(
            "NODE_ENV=development"
            "PORT=$($Config["BACKEND_PORT"])"
            "DB_DIALECT=mysql"
            "DB_HOST=$($Config["DB_HOST"])"
            "DB_PORT=$($Config["DB_PORT"])"
            "DB_NAME=$($Config["DB_NAME"])"
            "DB_USER=$($Config["DB_USER"])"
            "DB_PASS=$($Config["DB_PASS"])"
            "JWT_SECRET=$($Config["JWT_SECRET"])"
            "JWT_REFRESH_SECRET=$($Config["JWT_REFRESH_SECRET"])"
            "REDIS_URL=redis://127.0.0.1:$($Config["REDIS_PORT"])"
            "WHATSAPP_PROVIDER=$($Config["WHATSAPP_PROVIDER"])"
            "LOG_LEVEL=info"
            ""
        ) -join "`n")
        Write-Step "backend\.env.localhost gerado"
    }

    if ($Force -or -not (Test-Path $frontendEnv)) {
        Write-Utf8 $frontendEnv "VITE_BACKEND_URL=http://localhost:$($Config["BACKEND_PORT"])`n"
        Write-Step "frontend\.env.localhost gerado"
    }
}

function Set-ProcessEnv($Config) {
    $env:UNMESS_LOCAL = "1"
    $env:ASPNETCORE_ENVIRONMENT = "Development"
    $env:Database__ConnectionString = "Server=$($Config["DB_HOST"]);Port=$($Config["DB_PORT"]);Database=$($Config["DB_NAME"]);User ID=$($Config["DB_USER"]);Password=$($Config["DB_PASS"])"
    $env:Jwt__Secret = $Config["JWT_SECRET"]
    $env:WhatsappGateway__BaseUrl = "http://localhost:$($Config["GATEWAY_PORT"])"
    $env:WhatsappGateway__ApiToken = $Config["GATEWAY_API_TOKEN"]
    $env:WhatsappGateway__WebhookSecret = $Config["GATEWAY_WEBHOOK_SECRET"]
    $env:GATEWAY_PORT = $Config["GATEWAY_PORT"]
    $env:GATEWAY_MODE = $Config["GATEWAY_MODE"]
    $env:GATEWAY_API_TOKEN = $Config["GATEWAY_API_TOKEN"]
    $env:GATEWAY_WEBHOOK_SECRET = $Config["GATEWAY_WEBHOOK_SECRET"]
    $env:GATEWAY_ENCRYPTION_KEY = $Config["GATEWAY_ENCRYPTION_KEY"]
    $env:GATEWAY_SEND_INTERVAL_MS = $Config["GATEWAY_SEND_INTERVAL_MS"]
    $env:GATEWAY_CORE_WEBHOOK_URL = "http://localhost:$($Config["DOTNET_API_PORT"])/internal/whatsapp-gateway/events"
    $env:GATEWAY_DATA_DIR = Join-Path $Root "whatsapp-gateway\data"
    Remove-Item Env:PORT -ErrorAction SilentlyContinue
}

function Invoke-Setup {
    Write-Step "Verificando ferramentas"
    $nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
    if ($nodeMajor -lt 24) { throw "Node 24 ou superior e necessario (encontrado $(node --version))." }
    if (-not ((dotnet --list-sdks) -match "^10\.")) { throw ".NET SDK 10 nao encontrado. Instale em https://dot.net" }
    if (-not (Test-Tool "docker")) { Write-Warn "Docker nao encontrado. O setup continua, mas 'up' so funciona com o Docker Desktop instalado." }

    if (-not (Test-Path $EnvFile)) {
        Write-Step "Criando .env a partir do .env.example com segredos novos"
        $content = Get-Content -Path (Join-Path $Root ".env.example") -Encoding UTF8 | ForEach-Object {
            if ($_ -match '^(GATEWAY_ENCRYPTION_KEY)=gerar$') { "$($Matches[1])=$(New-Secret -Hex)" }
            elseif ($_ -match '^([A-Z_]+)=gerar$') { "$($Matches[1])=$(New-Secret)" }
            else { $_ }
        }
        Write-Utf8 $EnvFile (($content -join "`n") + "`n")
    }
    else {
        Write-Step ".env ja existe, mantido"
    }

    $config = Get-Config
    Write-AppEnvFiles $config

    $env:PUPPETEER_SKIP_DOWNLOAD = "1"
    Write-Step "Instalando dependencias da raiz"
    Invoke-In "." { npm install --no-audit --no-fund }
    Write-Step "Instalando dependencias do backend Node"
    Invoke-In "backend" { npm ci --no-audit --no-fund }
    Write-Step "Instalando dependencias do frontend"
    Invoke-In "frontend" { npm ci --no-audit --no-fund }
    Write-Step "Instalando dependencias do gateway WhatsApp"
    Invoke-In "whatsapp-gateway" { npm ci --no-audit --no-fund }
    Write-Step "Restaurando pacotes .NET"
    Invoke-In "backend-dotnet" { dotnet restore Unmess.slnx }
    Invoke-In "deployer" { dotnet restore Unmess.Deployer.slnx }
    Write-Step "Compilando backend Node"
    Invoke-In "backend" { npm run build }

    Write-Host ""
    Write-Host "Pronto. Proximos passos: .\scripts\dev.ps1 up; .\scripts\dev.ps1 migrate; .\scripts\dev.ps1 seed; .\scripts\dev.ps1 dev" -ForegroundColor Green
}

function Invoke-Up {
    $config = Get-Config
    Assert-Development $config
    Write-Step "Subindo MySQL e Redis"
    Invoke-Compose @("up", "-d", "--wait")
    Invoke-Compose @("ps")
}

function Invoke-Migrate {
    $config = Get-Config
    Assert-Development $config
    Set-ProcessEnv $config
    Invoke-In "backend" { node ..\scripts\select-env.js backend; npm run db:migrate }
}

function Invoke-Seed {
    $config = Get-Config
    Assert-Development $config
    Set-ProcessEnv $config
    Invoke-In "backend" { node ..\scripts\select-env.js backend; npx sequelize db:seed:all }
}

function Invoke-Dev {
    $config = Get-Config
    Assert-Development $config
    Write-AppEnvFiles $config
    Set-ProcessEnv $config
    Write-Step "Backend Node :$($config["BACKEND_PORT"]) | .NET :$($config["DOTNET_API_PORT"]) | Gateway :$($config["GATEWAY_PORT"]) ($($config["GATEWAY_MODE"])) | Frontend :$($config["FRONTEND_PORT"])"
    Invoke-In "." {
        npx concurrently --kill-others-on-fail --names "node,dotnet,gateway,front" --prefix-colors "green,magenta,yellow,cyan" `
            "npm run dev --prefix backend" `
            "dotnet watch --non-interactive --project backend-dotnet/src/Unmess.Api run --urls http://localhost:$($config["DOTNET_API_PORT"])" `
            "npm run dev --prefix whatsapp-gateway" `
            "npm run dev --prefix frontend -- --port $($config["FRONTEND_PORT"]) --strictPort"
    }
}

function Invoke-Test {
    Write-Step "Testes .NET (backend-dotnet)"
    Invoke-In "." { dotnet test backend-dotnet/Unmess.slnx }
    Write-Step "Testes .NET (deployer)"
    Invoke-In "." { dotnet test deployer/Unmess.Deployer.slnx }
    Write-Step "Gateway WhatsApp: tipos e testes"
    Invoke-In "whatsapp-gateway" { npm run typecheck; npm test }
    Write-Step "Backend Node: compilacao"
    Invoke-In "backend" { npm run build }
}

function Invoke-Down {
    Invoke-Compose @("down")
}

function Invoke-Status {
    $config = Get-Config
    if (Test-Tool "docker") { Invoke-Compose @("ps") } else { Write-Warn "Docker nao encontrado." }
    $checks = @(
        @{ Name = "Backend Node"; Url = "http://localhost:$($config["BACKEND_PORT"])/"; AnyResponse = $true },
        @{ Name = "Backend .NET"; Url = "http://localhost:$($config["DOTNET_API_PORT"])/health/live" },
        @{ Name = "Gateway"; Url = "http://localhost:$($config["GATEWAY_PORT"])/health/ready" },
        @{ Name = "Frontend"; Url = "http://localhost:$($config["FRONTEND_PORT"])/" }
    )
    foreach ($check in $checks) {
        try {
            $response = Invoke-WebRequest -Uri $check.Url -UseBasicParsing -TimeoutSec 3 -Headers @{ Accept = "text/html" }
            Write-Host ("{0,-14} {1} ({2})" -f $check.Name, "OK", $response.StatusCode) -ForegroundColor Green
        }
        catch {
            $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
            if ($check.AnyResponse -and $code -gt 0 -and $code -lt 500) {
                Write-Host ("{0,-14} {1} ({2})" -f $check.Name, "OK", $code) -ForegroundColor Green
            }
            else {
                Write-Host ("{0,-14} {1} ({2})" -f $check.Name, "FALHA", $(if ($code) { $code } else { "sem resposta" })) -ForegroundColor Red
            }
        }
    }
}

function Invoke-Reset {
    $config = Get-Config
    Assert-Development $config
    if (-not $Force) { throw "reset apaga o banco e o Redis de DEV. Confirme com: .\scripts\dev.ps1 reset -Force" }
    Invoke-Compose @("down", "--volumes")
}

switch ($Command) {
    "setup" { Invoke-Setup }
    "up" { Invoke-Up }
    "dev" { Invoke-Dev }
    "migrate" { Invoke-Migrate }
    "seed" { Invoke-Seed }
    "test" { Invoke-Test }
    "down" { Invoke-Down }
    "status" { Invoke-Status }
    "reset" { Invoke-Reset }
    default {
        Write-Host @"
Uso: .\scripts\dev.ps1 <comando>

  setup    instala dependencias, cria .env com segredos de dev e os .env.localhost
  up       sobe MySQL e Redis (deploy/compose.dev.yaml)
  migrate  roda as migrations do backend Node no banco de dev
  seed     cria os dados iniciais (super@whaticket.com / super123)
  dev      roda backend Node, backend .NET, gateway e frontend com hot reload
  test     roda os mesmos testes do CI
  status   mostra o que esta de pe
  down     para os containers (mantem os dados)
  reset    apaga os dados de dev (exige -Force)
"@
    }
}
