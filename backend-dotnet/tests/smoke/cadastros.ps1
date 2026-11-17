. "$PSScriptRoot\lib.ps1"
$admin = (New-CompanyAdmin).Token

"--- settings"
Show "attendance (padroes)" (Call GET "/settings/attendance" $null $admin) 200
Show "put signMessages" (Call PUT "/settings/signMessages" @{ value = "disabled" } $admin) 200
Show "attendance apos alterar" (Call GET "/settings/attendance" $null $admin) 200
Show "lista settings" (Call GET "/settings" $null $admin) 200

"--- queues"
Show "fila nome curto" (Call POST "/queue" @{ name = "A"; color = "#ff0000" } $admin) 400
Show "fila cor invalida" (Call POST "/queue" @{ name = "Vendas"; color = "vermelho" } $admin) 400
$r = Call POST "/queue" @{ name = "Vendas"; color = "#ff0000"; greetingMessage = "Oi" } $admin; Show "cria fila" $r 200
$fila = (Json $r).id
Show "fila duplicada" (Call POST "/queue" @{ name = "Vendas"; color = "#00ff00" } $admin) 400
$r = Call POST "/queue" @{ name = "Suporte"; color = "#0000ff" } $admin; $fila2 = (Json $r).id
Show "edita fila padrao (201)" (Call PUT "/queue/$fila" @{ name = "Vendas"; color = "#ff0000"; isDefault = $true } $admin) 201
Show "outra vira padrao" (Call PUT "/queue/$fila2" @{ color = "#0000ff"; isDefault = $true } $admin) 201
Show "lista filas" (Call GET "/queue" $null $admin) 200
Show "remove fila" (Call DELETE "/queue/$fila" $null $admin) 200
Show "fila removida" (Call GET "/queue/$fila" $null $admin) 400

"--- tags"
$r = Call POST "/tags" @{ name = "VIP" } $admin; Show "cria tag" $r 200
$tag = (Json $r).id
Show "tag duplicada" (Call POST "/tags" @{ name = "VIP" } $admin) 400
Show "tag sem nome" (Call POST "/tags" @{ color = "#000" } $admin) 400
Show "edita tag" (Call PUT "/tags/$tag" @{ color = "#123456" } $admin) 200
Show "busca tag" (Call GET "/tags?searchParam=VI" $null $admin) 200
Show "remove tag" (Call DELETE "/tags/$tag" $null $admin) 200
Show "remove tag inexistente" (Call DELETE "/tags/$tag" $null $admin) 404

"--- quick answers"
$r = Call POST "/quick-answers" @{ shortcut = "oi"; message = "Ola, tudo bem?" } $admin; Show "cria resposta" $r 200
$qa = (Json $r).id
Show "atalho duplicado" (Call POST "/quick-answers" @{ shortcut = "oi"; message = "x" } $admin) 400
Show "sem mensagem" (Call POST "/quick-answers" @{ shortcut = "tchau" } $admin) 400
Show "edita resposta" (Call PUT "/quick-answers/$qa" @{ message = "Ola!" } $admin) 200
Show "lista respostas" (Call GET "/quick-answers?searchParam=ola" $null $admin) 200
Show "remove resposta" (Call DELETE "/quick-answers/$qa" $null $admin) 200

"--- ticket statuses"
Show "tipo invalido" (Call POST "/ticket-statuses" @{ name = "Resolvido"; type = "outro" } $admin) 400
$r = Call POST "/ticket-statuses" @{ name = "Resolvido"; color = "#00ff00"; isDefault = $true } $admin; Show "cria status" $r 200
$st = (Json $r).id
$r = Call POST "/ticket-statuses" @{ name = "Sem resposta"; isDefault = $true } $admin; Show "novo padrao" $r 200
Show "lista status" (Call GET "/ticket-statuses" $null $admin) 200
Show "remove status" (Call DELETE "/ticket-statuses/$st" $null $admin) 200

"--- business hours / holidays"
Show "horarios vazios" (Call GET "/business-hours" $null $admin) 200
Show "salva horarios" (Call PUT "/business-hours" @{ days = @(@{ weekDay = 1; enabled = $true; startTime = "08:00"; endTime = "17:00" }, @{ weekDay = 0; enabled = $false; startTime = "08:00"; endTime = "12:00" }) } $admin) 200
Show "atualiza horario" (Call PUT "/business-hours" @{ days = @(@{ weekDay = 1; enabled = $true; startTime = "09:00"; endTime = "18:00" }) } $admin) 200
$r = Call POST "/holidays" @{ name = "Natal"; date = "2026-12-25"; recurring = $true } $admin; Show "cria feriado" $r 200
$fer = (Json $r).id
Show "feriado duplicado" (Call POST "/holidays" @{ name = "Natal 2"; date = "2026-12-25" } $admin) 400
Show "feriado invalido" (Call POST "/holidays" @{ name = " " } $admin) 400
Show "lista feriados" (Call GET "/holidays" $null $admin) 200
Show "remove feriado" (Call DELETE "/holidays/$fer" $null $admin) 200
