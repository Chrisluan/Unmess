. "$PSScriptRoot\lib.ps1"
$empresa = New-CompanyAdmin
$admin = $empresa.Token

"--- produtos"
Show "produto sem nome" (Call POST "/products" @{ price = 10 } $admin) 400
Show "preco negativo" (Call POST "/products" @{ name = "Banner"; price = -1 } $admin) 400
$r = Call POST "/products" @{ name = "Banner"; code = "BN-1"; price = 49.9; cost = 20; unit = "m2"; pricingMode = "area"; minMeasure = 1; category = "Impressos" } $admin; Show "cria produto" $r 200
$produto = (Json $r).id
Call POST "/products" @{ name = "Adesivo"; price = 5; category = "Adesivos" } $admin | Out-Null
Show "edita produto" (Call PUT "/products/$produto" @{ price = 59.9 } $admin) 200
Show "busca produto" (Call GET "/products?searchParam=BN" $null $admin) 200
Show "categorias" (Call GET "/products/categories" $null $admin) 200
Show "desativa produto" (Call DELETE "/products/$produto" $null $admin) 200
Show "lista sem inativos" (Call GET "/products" $null $admin) 200
Show "lista com inativos" (Call GET "/products?includeInactive=true" $null $admin) 200

"--- contatos sem WhatsApp conectado"
Show "cria contato sem conexao (400)" (Call POST "/contacts" @{ name = "Maria"; number = "5585999990000" } $admin) 400

"--- contatos com WhatsApp simulado"
$conexao = Add-ConnectedWhatsapp $empresa.CompanyId
Show "numero com letras" (Call POST "/contacts" @{ name = "Maria"; number = "55859abc" } $admin) 400
Show "numero inexistente" (Call POST "/contacts" @{ name = "Maria"; number = "123" } $admin) 400
$r = Call POST "/contacts" @{ name = "Maria"; number = "5585 99999-0000"; email = "maria@teste.com"; extraInfo = @(@{ name = "CPF"; value = "123" }) } $admin; Show "cria contato" $r 200
$contato = (Json $r).id
Show "contato duplicado" (Call POST "/contacts" @{ name = "Maria 2"; number = "5585999990000" } $admin) 400
$r = Call GET "/contacts/$contato" $null $admin; Show "mostra contato" $r 200
$campo = (Json $r).extraInfo[0].id
Show "edita contato" (Call PUT "/contacts/$contato" @{ name = "Maria Silva"; number = "5585999990000"; extraInfo = @(@{ id = $campo; name = "CPF"; value = "456" }, @{ name = "Cidade"; value = "Fortaleza" }) } $admin) 200
Show "conhecido sem valor" (Call PUT "/contacts/$contato/known" @{ } $admin) 400
Show "marca conhecido" (Call PUT "/contacts/$contato/known" @{ isKnown = $true } $admin) 200
Show "lista contatos" (Call GET "/contacts?searchParam=maria" $null $admin) 200
Show "tickets do contato" (Call GET "/contacts/$contato/tickets" $null $admin) 200
Show "obter ou criar (existente)" (Call POST "/contact" @{ name = "x"; number = "5585999990000" } $admin) 200
Show "obter ou criar (novo)" (Call POST "/contact" @{ name = "Joao"; number = "5585988880000" } $admin) 200
Show "importa do aparelho" (Call POST "/contacts/import" $null $admin) 200
Show "contatos importados" (Call GET "/contacts?searchParam=simulado" $null $admin) 200

"--- clientes"
Show "cliente tipo invalido" (Call POST "/customers" @{ name = "Loja"; personType = "XX" } $admin) 400
$r = Call POST "/customers" @{ name = "Loja da Maria"; document = "12345678000199"; personType = "PJ"; contactId = $contato; status = "active" } $admin; Show "cria cliente" $r 200
$cliente = (Json $r).id
Show "documento duplicado" (Call POST "/customers" @{ name = "Outra"; document = "12345678000199" } $admin) 400
Show "edita cliente" (Call PUT "/customers/$cliente" @{ city = "Fortaleza"; email = "loja@teste.com" } $admin) 200
Show "email invalido" (Call PUT "/customers/$cliente" @{ email = "nao-e-email" } $admin) 400
Show "lista clientes" (Call GET "/customers?searchParam=loja&status=active" $null $admin) 200
Show "cliente por contato" (Call GET "/customers/by-contact/$contato" $null $admin) 200
Show "cliente por contato vazio" (Call GET "/customers/by-contact/999999" $null $admin) 200
Show "mostra cliente" (Call GET "/customers/$cliente" $null $admin) 200
Show "remove cliente" (Call DELETE "/customers/$cliente" $null $admin) 200
Show "remove contato" (Call DELETE "/contacts/$contato" $null $admin) 200

"--- figurinhas"
$png = New-TestImage
Show "figurinha sem nome" (Upload "/stickers" @{ } $png "image/png" $admin) 400
$r = Upload "/stickers" @{ name = "Joinha" } $png "image/png" $admin; Show "cria figurinha" $r 200
$figurinha = (Json $r).id
Show "lista figurinhas" (Call GET "/stickers?searchParam=joi" $null $admin) 200
Show "remove figurinha" (Call DELETE "/stickers/$figurinha" $null $admin) 200
Remove-Item $png
