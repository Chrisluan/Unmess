# Script para configurar Firewall do Windows para aceitar conexões em rede local

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CONFIGURAR FIREWALL - Rede Local    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se está rodando como admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "❌ Este script precisa rodar como ADMINISTRADOR!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instruções:" -ForegroundColor Yellow
    Write-Host "1. Abra PowerShell como Administrador" -ForegroundColor Yellow
    Write-Host "2. Execute: .\configure-firewall.ps1" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "✅ Rodando como Administrador" -ForegroundColor Green
Write-Host ""

# Portas a abrir
$ports = @(
    @{Name = "HTTP (Frontend)"; Port = 80; Protocol = "TCP"},
    @{Name = "HTTPS"; Port = 443; Protocol = "TCP"},
    @{Name = "Backend API"; Port = 8080; Protocol = "TCP"},
    @{Name = "Browserless"; Port = 3001; Protocol = "TCP"},
    @{Name = "MySQL"; Port = 3306; Protocol = "TCP"}
)

Write-Host "📝 Abrindo portas no Firewall..." -ForegroundColor Yellow
Write-Host ""

foreach ($port in $ports) {
    $ruleName = "WhatTicket-$($port.Name)"

    # Verificar se regra já existe
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

    if ($existingRule) {
        Write-Host "⏭️  Pulando $($port.Name) - Porta $($port.Port) (já configurada)" -ForegroundColor Gray
    } else {
        try {
            New-NetFirewallRule `
                -DisplayName $ruleName `
                -Direction Inbound `
                -Action Allow `
                -Protocol $port.Protocol `
                -LocalPort $port.Port `
                -Profile @('Public', 'Private') `
                -ErrorAction Stop | Out-Null

            Write-Host "✅ Porta $($port.Port) - $($port.Name) liberada" -ForegroundColor Green
        } catch {
            Write-Host "❌ Erro ao abrir porta $($port.Port): $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Firewall Configurado!               " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximo passo: Execute start-production.ps1" -ForegroundColor Green
Write-Host ""

Read-Host "Pressione Enter para fechar"
