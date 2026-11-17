. "$PSScriptRoot\lib.ps1"
$empresa = New-CompanyAdmin
$admin = $empresa.Token
$adminId = (Json (Call GET "/permission-groups/available" $null $admin)) | Out-Null
$me = Json (Call POST "/auth/login" @{ email = "admin$($empresa.Suffix)@teste.com"; password = "senha123" })
$adminId = $me.user.id

function Wait-Until([scriptblock]$probe, [int]$seconds = 15) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        $value = & $probe
        if ($value) { return $value }
        Start-Sleep -Milliseconds 300
    }
    return $null
}

"--- conexao"
$fila = (Json (Call POST "/queue" @{ name = "Vendas"; color = "#ff0000"; greetingMessage = "Bem-vindo ao setor {{setor}}!" } $admin)).id
$r = Call POST "/whatsapp" @{ name = "Principal"; queueIds = @($fila); farewellMessage = "Tchau, {{name}}!" } $admin; Show "cria conexao" $r 200
$conexao = (Json $r).id
Show "nome repetido" (Call POST "/whatsapp" @{ name = "Principal" } $admin) 400
$conectada = Wait-Until { $c = Json (Call GET "/whatsapp/$conexao" $null $admin); if ($c.status -eq "CONNECTED") { $c } }
if ($conectada) { "ok conexao ficou CONNECTED (numero $($conectada.number))" } else { "XX conexao nao conectou" }
Show "lista conexoes" (Call GET "/whatsapp" $null $admin) 200

"--- mensagem recebida"
Fake-Inbound $conexao @{ from = "5585977770000"; text = "Oi, quero um orcamento"; pushName = "Carla" } | Out-Null
$ticket = Wait-Until { (Json (Call GET "/tickets?showAll=true&queueIds=[$fila]" $null $admin)).tickets | Select-Object -First 1 }
if ($ticket) { "ok ticket criado #$($ticket.id) status=$($ticket.status) fila=$($ticket.queue.name) contato=$($ticket.contact.name) protocolo=$($ticket.protocol)" } else { "XX ticket nao criado" }
$r = Call GET "/messages/$($ticket.id)" $null $admin; Show "lista mensagens" $r 200
$mensagens = (Json $r).messages
if ($mensagens.Count -eq 1 -and $mensagens[0].body -eq "Oi, quero um orcamento" -and -not $mensagens[0].fromMe) { "ok mensagem recebida gravada" } else { "XX mensagens: $($r.Body)" }
Show "abas" (Call GET "/tickets/tab-rules" $null $admin) 200
Show "aba aguardando" (Call GET "/tickets?tab=waiting&queueIds=[$fila]" $null $admin) 200

"--- atendimento"
$r = Call PUT "/tickets/$($ticket.id)" @{ status = "open"; userId = $adminId } $admin; Show "aceita ticket" $r 200
$aceito = Json $r
if ($aceito.status -eq "open" -and $aceito.user.id -eq $adminId -and $aceito.firstResponseAt) { "ok ticket aberto com atendente e primeira resposta" } else { "XX ticket: $($r.Body)" }
Show "aba meus tickets" (Call GET "/tickets?tab=myTickets&queueIds=[$fila]" $null $admin) 200
Show "envia texto" (Call POST "/messages/$($ticket.id)" @{ body = "Ola {{name}}, tudo bem?" } $admin) 200
$enviada = Wait-Until { (Json (Call GET "/messages/$($ticket.id)" $null $admin)).messages | Where-Object { $_.fromMe -and $_.ack -ge 3 } | Select-Object -First 1 }
if ($enviada -and $enviada.body -eq "Ola Carla, tudo bem?") { "ok mensagem enviada com variavel e confirmada como lida (ack $($enviada.ack))" } else { "XX envio: $($enviada | ConvertTo-Json -Compress)" }
$r = Call POST "/messages/$($ticket.id)/notes" @{ body = "Cliente pediu desconto" } $admin; Show "nota interna" $r 200
Show "nota vazia" (Call POST "/messages/$($ticket.id)/notes" @{ body = " " } $admin) 400
Show "edita mensagem" (Call PUT "/messages/$($enviada.id)" @{ body = "Ola Carla!" } $admin) 200
Show "edita nota (400)" (Call PUT "/messages/$((Json $r).id)" @{ body = "x" } $admin) 400
$png = New-TestImage
$r = Upload "/messages/$($ticket.id)" @{ body = "Segue o modelo" } $png "image/png" $admin -Field "medias"; Show "envia imagem" $r 200
$tag = (Json (Call POST "/tags" @{ name = "Quente" } $admin)).id
$r = Call PUT "/tickets/$($ticket.id)/tags" @{ tagIds = @($tag) } $admin; Show "aplica tag" $r 200
Show "tag de outra empresa" (Call PUT "/tickets/$($ticket.id)/tags" @{ tagIds = @(999999) } $admin) 400
Show "filtra por tag" (Call GET "/tickets?showAll=true&tagIds=[$tag]&queueIds=[$fila]" $null $admin) 200
$figurinha = (Json (Upload "/stickers" @{ name = "Joia" } $png "image/png" $admin)).id
Show "envia figurinha" (Call POST "/stickers/$figurinha/send/$($ticket.id)" $null $admin) 200
$recebidaId = $mensagens[0].id
Show "salva figurinha de mensagem sem midia" (Call POST "/stickers/from-message/$recebidaId" @{ name = "x" } $admin) 400
$todas = (Json (Call GET "/messages/$($ticket.id)" $null $admin)).messages
$imagem = $todas | Where-Object { $_.mediaType -eq "image" } | Select-Object -First 1
Show "salva figurinha de imagem" (Call POST "/stickers/from-message/$($imagem.id)" @{ name = "Modelo" } $admin) 200
Show "apaga mensagem" (Call DELETE "/messages/$($enviada.id)" $null $admin) 200
$outro = (Json (Call POST "/contact" @{ name = "Bruno"; number = "5585966660000" } $admin)).id
$r = Call POST "/messages/$($recebidaId)/forward" @{ toContactId = $outro } $admin; Show "encaminha para contato" $r 200
Show "busca por mensagem" (Call GET "/tickets?searchParam=orcamento&queueIds=[$fila]" $null $admin) 200
Show "busca por protocolo" (Call GET "/tickets?searchParam=$($ticket.protocol)&queueIds=[$fila]" $null $admin) 200
Show "tickets do contato" (Call GET "/contacts/$($ticket.contact.id)/tickets" $null $admin) 200

"--- encerramento"
$r = Call PUT "/tickets/$($ticket.id)" @{ status = "closed" } $admin; Show "encerra ticket" $r 200
$fechado = Json $r
if ($fechado.status -eq "closed" -and $fechado.closedAt -and -not $fechado.userId -and -not $fechado.queueId) { "ok encerrado limpando atendente e fila" } else { "XX encerramento: $($r.Body)" }
Call PUT "/settings/requireClosingStatus" @{ value = "enabled" } $admin | Out-Null
Fake-Inbound $conexao @{ from = "5585955550000"; text = "Bom dia"; pushName = "Davi" } | Out-Null
$novo = Wait-Until { (Json (Call GET "/tickets?showAll=true&searchParam=Davi&queueIds=[$fila]" $null $admin)).tickets | Select-Object -First 1 }
Show "encerrar sem motivo (400)" (Call PUT "/tickets/$($novo.id)" @{ status = "closed" } $admin) 400
Show "outro ticket aberto (400)" (Call POST "/tickets" @{ contactId = $novo.contact.id; status = "open"; userId = $adminId } $admin) 400

"--- escolha de fila"
$fila2 = (Json (Call POST "/queue" @{ name = "Suporte"; color = "#0000ff" } $admin)).id
Call PUT "/whatsapp/$conexao" @{ queueIds = @($fila, $fila2); greetingMessage = "Escolha um setor:" } $admin | Out-Null
Fake-Inbound $conexao @{ from = "5585944440000"; text = "Preciso de ajuda"; pushName = "Eva" } | Out-Null
$semFila = Wait-Until { (Json (Call GET "/tickets?showAll=true&searchParam=Eva&queueIds=[$fila,$fila2]" $null $admin)).tickets | Select-Object -First 1 }
if ($semFila -and -not $semFila.queueId) { "ok ticket sem fila aguardando escolha" } else { "XX fila: $($semFila | ConvertTo-Json -Compress -Depth 3)" }
Fake-Inbound $conexao @{ from = "5585944440000"; text = "2"; pushName = "Eva" } | Out-Null
$comFila = Wait-Until { $t = Json (Call GET "/tickets/$($semFila.id)" $null $admin); if ($t.queueId -eq $fila2) { $t } }
if ($comFila) { "ok opcao 2 colocou o ticket na fila Suporte" } else { "XX escolha de fila nao aplicada" }

"--- grupo"
Fake-Inbound $conexao @{ from = "5585933330000"; text = "Oi pessoal"; pushName = "Fabio"; groupId = "120363001"; groupName = "Clientes VIP" } | Out-Null
$grupo = Wait-Until { (Json (Call GET "/tickets?showAll=true&groups=only&queueIds=[$fila,$fila2]" $null $admin)).tickets | Select-Object -First 1 }
if ($grupo -and $grupo.isGroup -and $grupo.contact.name -eq "Clientes VIP") { "ok ticket de grupo com o nome do grupo" } else { "XX grupo: $($grupo | ConvertTo-Json -Compress -Depth 3)" }

"--- sessao"
Show "desconecta sessao" (Call DELETE "/whatsappsession/$conexao" $null $admin) 200
$desconectada = Wait-Until { $c = Json (Call GET "/whatsapp/$conexao" $null $admin); if ($c.status -eq "DISCONNECTED") { $c } }
if ($desconectada) { "ok conexao DISCONNECTED" } else { "XX conexao nao desconectou" }
Show "envio sem sessao (400)" (Call POST "/messages/$($novo.id)" @{ body = "teste" } $admin) 400
Show "novo QR" (Call PUT "/whatsappsession/$conexao" $null $admin) 200
$reconectada = Wait-Until { $c = Json (Call GET "/whatsapp/$conexao" $null $admin); if ($c.status -eq "CONNECTED") { $c } }
if ($reconectada) { "ok conexao reconectada" } else { "XX nao reconectou" }
Show "remove ticket" (Call DELETE "/tickets/$($novo.id)" $null $admin) 200
Remove-Item $png
