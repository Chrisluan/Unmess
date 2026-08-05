# Script para iniciar a aplicação em produção (rede local)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WHATICKET - Inicialização Produção  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar privilégios de admin para firewall
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if ($isAdmin) {
    Write-Host "✅ Rodando como Administrador (Firewall será configurado)" -ForegroundColor Green
} else {
    Write-Host "⚠️  NÃO está rodando como Admin (Firewall manual necessário)" -ForegroundColor Yellow
}

# Descobrir IP local
Write-Host "📡 Encontrando seu IP local..." -ForegroundColor Yellow
$ipv4 = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notmatch "127.0.0.1"} | Select-Object -First 1).IPAddress

if ($ipv4) {
    Write-Host "✅ IP Local encontrado: $ipv4" -ForegroundColor Green
} else {
    Write-Host "❌ Não consegui encontrar o IP local. Execute 'ipconfig' manualmente." -ForegroundColor Red
    Read-Host "Pressione Enter para continuar"
    exit 1
}

Write-Host ""

# Configurar Firewall se for admin
if ($isAdmin) {
    Write-Host "🔥 Configurando Firewall..." -ForegroundColor Yellow

    $ports = @(
        @{Name = "HTTP"; Port = 80; Protocol = "TCP"},
        @{Name = "HTTPS"; Port = 443; Protocol = "TCP"},
        @{Name = "API"; Port = 8080; Protocol = "TCP"},
        @{Name = "Browserless"; Port = 3001; Protocol = "TCP"},
        @{Name = "MySQL"; Port = 3306; Protocol = "TCP"}
    )

    foreach ($port in $ports) {
        $ruleName = "WhatTicket-$($port.Name)"
        $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

        if (-not $existingRule) {
            New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
                -Protocol $port.Protocol -LocalPort $port.Port -Profile @('Public', 'Private') -ErrorAction SilentlyContinue | Out-Null
        }
    }

    Write-Host "✅ Firewall configurado" -ForegroundColor Green
} else {
    Write-Host "⚠️  Firewall: Você precisa configurar manualmente:" -ForegroundColor Yellow
    Write-Host "   1. Abra PowerShell como ADMINISTRADOR" -ForegroundColor Gray
    Write-Host "   2. Execute: .\configure-firewall.ps1" -ForegroundColor Gray
    Write-Host ""
}

Write-Host ""
Write-Host "🔍 Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✅ Docker está instalado: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker não está instalado ou não está em PATH" -ForegroundColor Red
    Write-Host "   Instale Docker Desktop e tente novamente" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""
Write-Host "📝 Verificando .env.network..." -ForegroundColor Yellow
if (Test-Path ".env.network") {
    Write-Host "✅ Arquivo .env.network encontrado" -ForegroundColor Green

    $envContent = Get-Content ".env.network" -Raw
    if ($envContent -match "MYSQL_ROOT_PASSWORD=$|JWT_SECRET=$") {
        Write-Host "⚠️  AVISO: Existem variáveis vazias em .env.network" -ForegroundColor Red
        Write-Host "   Preencha MYSQL_ROOT_PASSWORD e JWT_SECRET antes de continuar!" -ForegroundColor Red
        Write-Host ""
        Write-Host "   Arquivo: .env.network" -ForegroundColor Yellow
        Read-Host "   Pressione Enter após atualizar o arquivo"
    }
} else {
    Write-Host "❌ Arquivo .env.network não encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Iniciando containers..." -ForegroundColor Yellow
Write-Host ""

docker-compose -f docker-compose.yml --env-file .env.network up -d

if ($?) {
    Write-Host ""
    Write-Host "✅ Containers iniciados com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  🎉 Aplicação Pronta para Usar 🎉    " -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📱 Acesse de qualquer computador na rede:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   🌐 Frontend:     http://$ipv4" -ForegroundColor Green
    Write-Host "   🔌 API:          http://$ipv4:8080/api" -ForegroundColor Green
    Write-Host "   💾 MySQL:        $ipv4:3306" -ForegroundColor Green
    Write-Host "   ⚙️  Browserless:  http://$ipv4:3001" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Ver logs:" -ForegroundColor Yellow
    Write-Host "   docker-compose logs -f" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🧪 Testar conectividade:" -ForegroundColor Yellow
    Write-Host "   .\test-network-access.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⛔ Parar aplicação:" -ForegroundColor Yellow
    Write-Host "   docker-compose down" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📖 Documentação completa:" -ForegroundColor Yellow
    Write-Host "   GUIA-ACESSO-REDE.md" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Erro ao iniciar containers!" -ForegroundColor Red
    Write-Host "   Verifique os logs acima" -ForegroundColor Red
    exit 1
}

Read-Host "Pressione Enter para fechar"
