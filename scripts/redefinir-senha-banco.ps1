# RECUPERACAO SEM SENHA DE ADMINISTRADOR
#
# Redefine a senha do usuario da aplicacao no MySQL quando nem ela nem a do
# root sao conhecidas. Usa o procedimento oficial do MySQL: o servidor executa
# um arquivo SQL na subida (init_file), o que dispensa autenticacao.
#
# Por que passar pelo my.ini em vez de rodar mysqld solto: assim o servico do
# Windows continua sendo quem sobe e desce o banco, e toda parada e graciosa.
# Um mysqld iniciado a mao teria de ser encerrado a forca, o que deixaria o
# InnoDB para recuperar na proxima subida -- desnecessario com dados reais.
#
# Uso (PowerShell como Administrador):
#   cd C:\unmess
#   .\scripts\redefinir-senha-banco.ps1

param(
    [string]$MyIni    = "C:\mysql\my.ini",
    [string]$MysqlExe = "C:\mysql\bin\mysql.exe",
    [string]$Servico  = "MySQL80"
)

$ErrorActionPreference = "Stop"
function Escrever($t, $c = "Gray") { Write-Host $t -ForegroundColor $c }

Escrever ""
Escrever "  Redefinicao da senha do banco" "Cyan"
Escrever "  -----------------------------" "Cyan"
Escrever ""

$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $admin) { Escrever "  Precisa rodar como Administrador." "Red"; exit 1 }
foreach ($p in @($MyIni, $MysqlExe)) {
    if (-not (Test-Path $p)) { Escrever "  Nao encontrei: $p" "Red"; exit 1 }
}

$envBackend = "C:\unmess\backend\.env"
$conteudoEnv = Get-Content $envBackend -Raw
$usuarioApp = if ($conteudoEnv -match '(?m)^\s*DB_USER\s*=\s*(.*)$') { $matches[1].Trim() } else { "unmess" }
$datadir = if ((Get-Content $MyIni -Raw) -match '(?m)^\s*datadir\s*=\s*(.*)$') { $matches[1].Trim().Replace('/', '\') } else { $null }

Escrever "  Usuario da aplicacao: $usuarioApp"
Escrever "  Dados do banco      : $datadir"
Escrever ""

# ---- 1. copia de seguranca ------------------------------------------------
#
# 197 MB copiam em segundos e sao a unica rede de protecao real: se a
# redefinicao der errado, e daqui que as conversas voltam.

$carimbo = Get-Date -Format "yyyyMMdd-HHmmss"
$reservaDados = "C:\mysqldata-backup-$carimbo"
$reservaIni = "$MyIni.backup-$carimbo"

Escrever "  Copiando os dados do banco (pode levar um minuto)..." "Yellow"
Copy-Item $datadir $reservaDados -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item $MyIni $reservaIni -Force
Escrever "  Copia em $reservaDados" "Green"
Escrever "  Copia do my.ini em $reservaIni" "Green"
Escrever ""

# ---- 2. senha nova, gravada ANTES de ser aplicada --------------------------
#
# Foi a ordem inversa que causou o problema original: a senha entrou no banco,
# o passo seguinte falhou, e o valor se perdeu sem estar em lugar nenhum.

$bytes = New-Object byte[] 24
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$novaSenha = ([Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', '') + "Aa1"

$rascunho = "C:\unmess\backend\.senha-nova-temporaria.txt"
Set-Content -Path $rascunho -Value $novaSenha -Encoding utf8 -NoNewline
Escrever "  Senha nova guardada em $rascunho" "Yellow"

# ---- 3. arquivo de inicializacao ------------------------------------------

$sqlPath = "C:\mysql\redefinir-senha.sql"
$sqlConteudo = @"
ALTER USER '$usuarioApp'@'localhost' IDENTIFIED BY '$novaSenha';
FLUSH PRIVILEGES;
"@
Set-Content -Path $sqlPath -Value $sqlConteudo -Encoding ascii
Escrever "  Arquivo de inicializacao criado." "Green"

# ---- 4. apontar o my.ini para ele -----------------------------------------

$linhas = Get-Content $MyIni
$saida = New-Object System.Collections.Generic.List[string]
$inserido = $false
foreach ($l in $linhas) {
    $saida.Add($l)
    if (-not $inserido -and $l.Trim() -eq "[mysqld]") {
        $saida.Add("init_file=C:/mysql/redefinir-senha.sql")
        $inserido = $true
    }
}
if (-not $inserido) { Escrever "  Nao achei a secao [mysqld] no my.ini." "Red"; exit 1 }
Set-Content -Path $MyIni -Value $saida -Encoding ascii

# ---- 5. reiniciar o servico para executar o SQL ---------------------------

Escrever ""
Escrever "  Reiniciando o MySQL para aplicar..." "Yellow"
try {
    Stop-Service $Servico -Force
    (Get-Service $Servico).WaitForStatus('Stopped', (New-TimeSpan -Seconds 90))
    Start-Service $Servico
    (Get-Service $Servico).WaitForStatus('Running', (New-TimeSpan -Seconds 90))
    Start-Sleep -Seconds 5
    Escrever "  MySQL no ar." "Green"
} catch {
    Escrever "  Falha ao reiniciar: $($_.Exception.Message)" "Red"
    Escrever "  Restaurando o my.ini original..." "Yellow"
    Copy-Item $reservaIni $MyIni -Force
    try { Start-Service $Servico } catch {}
    Escrever "  my.ini restaurado. Os dados estao intactos em $reservaDados" "Yellow"
    exit 1
}

# ---- 6. tirar o init_file (ele so vale para esta subida) -------------------

Copy-Item $reservaIni $MyIni -Force
Remove-Item $sqlPath -Force -ErrorAction SilentlyContinue
Escrever "  my.ini devolvido ao estado normal." "Green"

# ---- 7. conferir antes de gravar ------------------------------------------

$env:MYSQL_PWD = $novaSenha
$teste = & $MysqlExe -h 127.0.0.1 --protocol=TCP -u $usuarioApp -N -B -e "SELECT 'ok';" 2>&1
$codigo = $LASTEXITCODE
$env:MYSQL_PWD = $null

if ($codigo -ne 0 -or "$teste" -notmatch 'ok') {
    Escrever ""
    Escrever "  A senha nova nao conectou: $teste" "Red"
    Escrever "  O .env NAO foi alterado. A senha esta em $rascunho" "Yellow"
    Escrever "  Dados preservados em $reservaDados" "Yellow"
    exit 1
}
Escrever "  Conexao conferida com a senha nova." "Green"

# ---- 8. gravar no .env e subir o backend ----------------------------------

$conteudoEnv = $conteudoEnv -replace '(?m)^\s*DB_PASS\s*=.*$', "DB_PASS=$novaSenha"
Set-Content -Path $envBackend -Value $conteudoEnv -Encoding utf8 -NoNewline
Escrever "  backend\.env atualizado." "Green"

Escrever ""
Escrever "  Reiniciando o backend..." "Yellow"
try {
    Restart-Service -Name 'unmess-backend' -ErrorAction Stop
    (Get-Service 'unmess-backend').WaitForStatus('Running', (New-TimeSpan -Seconds 60))
    Start-Sleep -Seconds 8
    Escrever "  Backend no ar." "Green"
} catch {
    Escrever "  Reinicie manualmente: Restart-Service unmess-backend" "Yellow"
}

Escrever ""
Escrever "  Pronto. Confira o login e, se estiver tudo certo, apague:" "Cyan"
Escrever "    Remove-Item $rascunho" "Gray"
Escrever "    Remove-Item $reservaDados -Recurse   (so depois de conferir!)" "Gray"
Escrever ""
