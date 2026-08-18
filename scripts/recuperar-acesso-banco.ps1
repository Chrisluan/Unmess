# RECUPERACAO: devolve ao backend o acesso ao banco.
#
# Contexto: a senha do usuario 'unmess' do MySQL foi trocada por um valor
# aleatorio que se perdeu, e por isso o backend nao consegue mais conectar.
# Este script define uma senha nova, grava no backend/.env e reinicia o
# servico.
#
# Precisa de uma conta do MySQL com privilegio para alterar outro usuario --
# normalmente root. A senha e pedida na hora e nao fica gravada em lugar nenhum.
#
# Uso (PowerShell como Administrador):
#   cd C:\unmess
#   .\scripts\recuperar-acesso-banco.ps1

param(
    [string]$UsuarioAdmin = "root",
    [string]$MysqlExe = "C:\mysql\bin\mysql.exe"
)

$ErrorActionPreference = "Stop"

function Escrever($texto, $cor = "Gray") { Write-Host $texto -ForegroundColor $cor }

Escrever ""
Escrever "  Recuperacao do acesso ao banco" "Cyan"
Escrever "  ------------------------------" "Cyan"
Escrever ""

if (-not (Test-Path $MysqlExe)) {
    Escrever "  Cliente do MySQL nao encontrado em: $MysqlExe" "Red"
    Escrever "  Passe o caminho com -MysqlExe" "Gray"
    exit 1
}

$env2 = "C:\unmess\backend\.env"
if (-not (Test-Path $env2)) {
    Escrever "  backend\.env nao encontrado." "Red"
    exit 1
}

$conteudo = Get-Content $env2 -Raw
$usuarioApp = if ($conteudo -match '(?m)^\s*DB_USER\s*=\s*(.*)$') { $matches[1].Trim() } else { "unmess" }

Escrever "  Usuario da aplicacao : $usuarioApp"
Escrever "  Usuario administrador: $UsuarioAdmin"
Escrever ""

$senhaAdmin = Read-Host "  Senha do $UsuarioAdmin no MySQL" -AsSecureString
$textoAdmin = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($senhaAdmin))

# Senha nova, forte e gravada em disco ANTES de ser aplicada no banco.
# Foi exatamente a ordem inversa que causou o problema: a senha entrou no
# MySQL, o passo seguinte falhou, e o valor se perdeu sem estar em lugar nenhum.
Add-Type -AssemblyName System.Web
$novaSenha = [System.Web.Security.Membership]::GeneratePassword(32, 0) -replace '[^A-Za-z0-9]', 'x'

$rascunho = "C:\unmess\backend\.senha-nova-temporaria.txt"
Set-Content -Path $rascunho -Value $novaSenha -Encoding utf8 -NoNewline
Escrever "  Senha nova guardada em $rascunho (apague depois)" "Yellow"

$env:MYSQL_PWD = $textoAdmin

Escrever ""
Escrever "  Aplicando no MySQL..." "Yellow"

$sql = @"
ALTER USER '$usuarioApp'@'localhost' IDENTIFIED BY '$novaSenha';
FLUSH PRIVILEGES;
"@

$saida = & $MysqlExe -h 127.0.0.1 --protocol=TCP -u $UsuarioAdmin -N -B -e $sql 2>&1
$codigo = $LASTEXITCODE
$env:MYSQL_PWD = $null
Remove-Variable textoAdmin -ErrorAction SilentlyContinue

if ($codigo -ne 0) {
    Escrever "  Falhou: $saida" "Red"
    Escrever ""
    Escrever "  Se a conta '$usuarioApp'@'localhost' nao existir, tente com o host '%':" "Gray"
    Escrever "  ALTER USER '$usuarioApp'@'%' IDENTIFIED BY '<senha do arquivo acima>';" "Gray"
    exit 1
}

Escrever "  Senha alterada no MySQL." "Green"

# Confere ANTES de gravar no .env: gravar uma senha que nao funciona deixaria a
# aplicacao quebrada de um jeito mais dificil de enxergar.
$env:MYSQL_PWD = $novaSenha
$teste = & $MysqlExe -h 127.0.0.1 --protocol=TCP -u $usuarioApp -N -B -e "SELECT 'ok';" 2>&1
$codigoTeste = $LASTEXITCODE
$env:MYSQL_PWD = $null

if ($codigoTeste -ne 0 -or "$teste" -notmatch 'ok') {
    Escrever "  A senha nova nao conectou: $teste" "Red"
    Escrever "  O .env NAO foi alterado. A senha esta em $rascunho" "Yellow"
    exit 1
}

Escrever "  Conexao conferida com a senha nova." "Green"

$conteudo = $conteudo -replace '(?m)^\s*DB_PASS\s*=.*$', "DB_PASS=$novaSenha"
Set-Content -Path $env2 -Value $conteudo -Encoding utf8 -NoNewline
Escrever "  backend\.env atualizado." "Green"

Escrever ""
Escrever "  Reiniciando o backend..." "Yellow"
try {
    Restart-Service -Name 'unmess-backend' -ErrorAction Stop
    (Get-Service 'unmess-backend').WaitForStatus('Running', (New-TimeSpan -Seconds 60))
    Escrever "  Backend no ar." "Green"
} catch {
    Escrever "  Nao consegui reiniciar: $($_.Exception.Message)" "Red"
    Escrever "  Rode manualmente: Restart-Service unmess-backend" "Gray"
}

Escrever ""
Escrever "  Confira o atendimento e depois apague o arquivo da senha:" "Cyan"
Escrever "  Remove-Item $rascunho" "Gray"
Escrever ""
