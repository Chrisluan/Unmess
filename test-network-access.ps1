# Script para testar acesso à aplicação na rede

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TESTE DE CONECTIVIDADE - Rede Local " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Descobrir IP local
$ipv4 = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notmatch "127.0.0.1"} | Select-Object -First 1).IPAddress

if (-not $ipv4) {
    Write-Host "❌ Não consegui encontrar o IP local" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "📡 IP Local: $ipv4" -ForegroundColor Green
Write-Host ""

# URLs a testar
$urls = @(
    @{Name = "Frontend (Página)"; Url = "http://$ipv4"; ExpectStatus = 200},
    @{Name = "Backend API"; Url = "http://$ipv4:8080/api"; ExpectStatus = 404},
    @{Name = "Health Check"; Url = "http://$ipv4/health"; ExpectStatus = 200},
    @{Name = "Browserless"; Url = "http://$ipv4:3001"; ExpectStatus = 200}
)

Write-Host "🔍 Testando endpoints..." -ForegroundColor Yellow
Write-Host ""

$passed = 0
$failed = 0

foreach ($test in $urls) {
    try {
        $response = Invoke-WebRequest -Uri $test.Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        $statusCode = $response.StatusCode

        if ($statusCode -eq $test.ExpectStatus -or $statusCode -lt 400) {
            Write-Host "✅ $($test.Name)" -ForegroundColor Green
            Write-Host "   Status: $statusCode | URL: $($test.Url)" -ForegroundColor Gray
            $passed++
        } else {
            Write-Host "⚠️  $($test.Name)" -ForegroundColor Yellow
            Write-Host "   Status: $statusCode (esperado: $($test.ExpectStatus)) | URL: $($test.Url)" -ForegroundColor Gray
            $failed++
        }
    } catch {
        Write-Host "❌ $($test.Name)" -ForegroundColor Red
        Write-Host "   Erro: $($_.Exception.Message)" -ForegroundColor Gray
        Write-Host "   URL: $($test.Url)" -ForegroundColor Gray
        $failed++
    }

    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Resultado do Teste                  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Passou: $passed" -ForegroundColor Green
Write-Host "❌ Falhou: $failed" -ForegroundColor Red
Write-Host ""

if ($failed -eq 0) {
    Write-Host "🎉 Tudo funcionando! Aplicação acessível em:" -ForegroundColor Green
    Write-Host ""
    Write-Host "   🌐 http://$ipv4" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "⚠️  Há problemas de conectividade." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Soluções possíveis:" -ForegroundColor Yellow
    Write-Host "1. Verifique se Docker está rodando: docker ps" -ForegroundColor Gray
    Write-Host "2. Configure o Firewall: .\configure-firewall.ps1" -ForegroundColor Gray
    Write-Host "3. Reinicie os containers: docker-compose restart" -ForegroundColor Gray
    Write-Host "4. Verifique logs: docker-compose logs -f" -ForegroundColor Gray
    Write-Host ""
}

Read-Host "Pressione Enter para fechar"
