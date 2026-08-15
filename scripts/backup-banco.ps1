# Backup diario do banco do Unmess.
#
# A sessao do WhatsApp (chaves do Baileys) fica na tabela WppKeys, dentro do
# proprio banco -- entao este dump tambem e o que evita ter que ler o QR Code
# de novo depois de um desastre.
#
# A senha nao fica escrita aqui: e lida do .env que o proprio backend usa,
# para nao existirem duas copias da mesma senha para manter em sincronia.

$ErrorActionPreference = "Stop"

$envFile   = "C:\unmess\backend\.env"
$destino   = "C:\unmess-backups"
$mysqldump = "C:\mysql\bin\mysqldump.exe"
$diasParaManter = 14

function LerEnv($chave) {
    $linha = Select-String -Path $envFile -Pattern "^$chave=" | Select-Object -First 1
    if (-not $linha) { throw "Chave $chave nao encontrada em $envFile" }
    return $linha.Line.Substring($chave.Length + 1).Trim()
}

$usuario = LerEnv "DB_USER"
$senha   = LerEnv "DB_PASS"
$banco   = LerEnv "DB_NAME"

if (-not (Test-Path $destino)) { New-Item -ItemType Directory -Path $destino | Out-Null }

$carimbo = Get-Date -Format "yyyy-MM-dd_HHmm"
$arquivo = Join-Path $destino "$banco-$carimbo.sql"

# --single-transaction faz o dump sem travar as tabelas: o atendimento
# continua funcionando enquanto o backup roda.
#
# --no-tablespaces porque o mysqldump do MySQL 8 tenta dumpar tablespaces por
# padrao, o que exige o privilegio PROCESS -- global, sobre o servidor inteiro.
# O usuario da aplicacao nao tem esse privilegio e nao deve ter.
& $mysqldump --single-transaction --routines --events --no-tablespaces `
    --default-character-set=utf8mb4 `
    -h 127.0.0.1 -u $usuario "--password=$senha" $banco --result-file=$arquivo

if ($LASTEXITCODE -ne 0) { throw "mysqldump falhou com codigo $LASTEXITCODE" }
if (-not (Test-Path $arquivo)) { throw "dump nao foi gerado" }

# Verificar o tamanho nao basta: um dump interrompido no meio tambem e grande,
# e o mysqldump ja saiu com codigo 0 depois de falhar. O marcador de conclusao
# so e escrito quando o dump termina inteiro -- e a unica prova confiavel.
$ultimas = Get-Content $arquivo -Tail 3 -ErrorAction SilentlyContinue
if (($ultimas -join "`n") -notmatch "Dump completed") {
    Remove-Item $arquivo -Force -ErrorAction SilentlyContinue
    throw "dump incompleto: marcador 'Dump completed' ausente no fim do arquivo"
}

# Comprime: um dump SQL encolhe cerca de 10x, e sao 14 copias guardadas.
$zip = [IO.Path]::ChangeExtension($arquivo, ".zip")
Compress-Archive -Path $arquivo -DestinationPath $zip -CompressionLevel Optimal -Force
Remove-Item $arquivo -Force

# Retencao: apaga apenas backups completos e antigos, nunca o mais recente.
$antigos = Get-ChildItem $destino -Filter "$banco-*.zip" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 1 |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$diasParaManter) }
foreach ($a in $antigos) { Remove-Item $a.FullName -Force }

$zipInfo = Get-Item $zip
"{0} | backup OK | {1:N1} MB | {2} removidos por idade" -f `
    (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), ($zipInfo.Length / 1MB), $antigos.Count |
    Add-Content -Path (Join-Path $destino "backup.log") -Encoding utf8
