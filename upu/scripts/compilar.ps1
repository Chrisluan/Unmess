<#
.SINOPSE
    Compila o UPU e deixa o resultado pronto para rodar em upu\publicacao.

.DESCRICAO
    Não precisa de Administrador: compilar é escrever numa pasta. Quem precisa
    de Administrador é instalar o serviço, e isso é o instalar-upu.ps1.

    Procura o dotnet em três lugares, na ordem: o PATH, a instalação de máquina
    e a instalação de usuário (~\.dotnet). A terceira existe porque o SDK pode
    ser instalado sem Administrador, e nesta máquina foi.

    Se o serviço já estiver instalado e rodando, ele segura os próprios DLLs e
    a publicação não tem como sobrescrevê-los. O script para antes e explica;
    com -PararServico (que precisa de Administrador) ele para, publica e sobe
    de novo sozinho.

.EXEMPLO
    .\scripts\compilar.ps1
    .\scripts\compilar.ps1 -PararServico
    .\scripts\compilar.ps1 -Destino D:\upu
#>
[CmdletBinding()]
param(
    [string]$Destino,
    [string]$NomeDoServico = "unmess-upu",
    [switch]$PararServico
)

$precisaSubirDeNovo = $false

$ErrorActionPreference = "Stop"

$raizDoUpu = Split-Path -Parent $PSScriptRoot
if (-not $Destino) { $Destino = Join-Path $raizDoUpu "publicacao" }

# ------------------------------------------------------------------ o dotnet

function Buscar-Dotnet {
    $noCaminho = (Get-Command dotnet -ErrorAction SilentlyContinue).Source
    if ($noCaminho) { return $noCaminho }

    $candidatos = @(
        (Join-Path $env:ProgramFiles "dotnet\dotnet.exe"),
        (Join-Path $env:USERPROFILE ".dotnet\dotnet.exe")
    )

    foreach ($candidato in $candidatos) {
        if (Test-Path $candidato) { return $candidato }
    }

    return $null
}

# ------------------------------------------------------- o serviço em pé

# Um serviço rodando segura os próprios DLLs, e a publicação falha no meio com
# dez linhas de MSB3026 por arquivo. A mensagem do MSBuild é verdadeira e
# ilegível; esta aqui diz o que fazer.

$emPe = Get-Service -Name $NomeDoServico -ErrorAction SilentlyContinue

if ($emPe -and $emPe.Status -ne "Stopped") {
    if ($PararServico) {
        try {
            Write-Host "  parando o serviço $NomeDoServico…"
            Stop-Service -Name $NomeDoServico -Force -ErrorAction Stop
            $emPe.WaitForStatus("Stopped", (New-TimeSpan -Seconds 30))
            $precisaSubirDeNovo = $true
        } catch {
            Write-Host ""
            Write-Host "  Não consegui parar o serviço: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "  Parar serviço precisa de Administrador."
            Write-Host ""
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "  O serviço $NomeDoServico está rodando e segura os arquivos." -ForegroundColor Yellow
        Write-Host "  Num PowerShell como Administrador:"
        Write-Host ""
        Write-Host "      Stop-Service $NomeDoServico" -ForegroundColor Cyan
        Write-Host "      .\scripts\compilar.ps1" -ForegroundColor Cyan
        Write-Host "      Start-Service $NomeDoServico" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Ou, de uma vez só (também como Administrador):"
        Write-Host "      .\scripts\compilar.ps1 -PararServico" -ForegroundColor Cyan
        Write-Host ""
        exit 1
    }
}

$dotnet = Buscar-Dotnet

if (-not $dotnet) {
    Write-Host ""
    Write-Host "  Não encontrei o .NET SDK nesta máquina." -ForegroundColor Red
    Write-Host "  Instale sem precisar de Administrador com:"
    Write-Host "      .\scripts\instalar-dotnet.ps1" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "  dotnet: $dotnet"

# --------------------------------------------------------------- a compilação

$solucao = Join-Path $raizDoUpu "src\Upu.Server\Upu.Server.csproj"

# As chaves em ${Destino} não são enfeite: sem elas, o "…" logo depois grudava
# no nome da variável e o PowerShell ia procurar uma variável que não existe,
# imprimindo a linha sem o caminho.
Write-Host "  compilando para ${Destino}…"

# Autocontido, e não dependente de um .NET instalado na máquina.
#
# O motivo é o serviço: ele roda como LocalSystem, e o SDK que compila isto aqui
# pode estar instalado no perfil de um usuário — foi o que aconteceu nesta
# máquina. LocalSystem não enxerga esse perfil, e o serviço subiria com um
# "You must install .NET to run this application" que não diz nada a quem está
# olhando o Gerenciador de Serviços às três da manhã.
#
# Custa uns 70 MB a mais na pasta. Em troca, a produção não passa a depender de
# nenhuma instalação de runtime que alguém possa remover.
#
# --nologo e a verbosidade baixa deixam o erro de compilação visível no meio de
# uma tela que, senão, seria só restauração de pacote.
& $dotnet publish $solucao `
    --configuration Release `
    --runtime win-x64 `
    --self-contained true `
    --output $Destino `
    --nologo `
    --verbosity minimal

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  A compilação falhou. Nada foi publicado." -ForegroundColor Red
    exit $LASTEXITCODE
}

# A pasta de dados fica FORA da publicação de propósito: republicar não pode
# apagar a configuração, as releases nem as inscrições de push.
$dados = Join-Path $raizDoUpu "dados"
if (-not (Test-Path $dados)) { New-Item -ItemType Directory -Path $dados | Out-Null }

if ($precisaSubirDeNovo) {
    Write-Host "  subindo o serviço $NomeDoServico de novo…"
    Start-Service -Name $NomeDoServico
    (Get-Service -Name $NomeDoServico).WaitForStatus("Running", (New-TimeSpan -Seconds 30))
}

Write-Host ""
Write-Host "  Pronto." -ForegroundColor Green
Write-Host "  Executável: $(Join-Path $Destino 'Upu.Server.exe')"
Write-Host "  Dados:      $dados"
Write-Host ""
Write-Host "  Para rodar agora, sem instalar o serviço:"
Write-Host "      & '$(Join-Path $Destino "Upu.Server.exe")'" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Para instalar como serviço do Windows (precisa de Administrador):"
Write-Host "      .\scripts\instalar-upu.ps1" -ForegroundColor Cyan
Write-Host ""
