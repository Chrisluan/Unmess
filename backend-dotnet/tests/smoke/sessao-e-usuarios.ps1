. "$PSScriptRoot\lib.ps1"
$r = Call POST "/auth/login" @{ email = "super@whaticket.com"; password = "errada" }; Show "login senha errada" $r 401
$r = Call POST "/auth/login" @{ email = "super@whaticket.com"; password = "super123" }; Show "login super" $r
$super = ($r.Body | ConvertFrom-Json).token

$r = Call GET "/users" $null $null; Show "users sem token" $r
$r = Call GET "/users" $null "abc.def.ghi"; Show "users token invalido" $r
$r = Call GET "/users" $null $super; Show "users super sem empresa" $r
$r = Call GET "/companies" $null $super; Show "companies" $r

$suffix = Get-Random
$r = Call POST "/companies" @{ name = "Empresa Teste $suffix"; adminName = "Admin Teste"; adminEmail = "admin$suffix@teste.com"; adminPassword = "senha123" } $super; Show "cria empresa" $r
$company = ($r.Body | ConvertFrom-Json).company

$r = Call POST "/auth/select-company" @{ companyId = $company.id } $super; Show "select-company" $r
$asCompany = ($r.Body | ConvertFrom-Json).token

$r = Call POST "/auth/refresh_token" $null $asCompany; Show "refresh mantendo empresa" $r

$r = Call POST "/auth/login" @{ email = "admin$suffix@teste.com"; password = "senha123" }; Show "login admin da empresa" $r
$admin = ($r.Body | ConvertFrom-Json).token

$r = Call GET "/users" $null $admin; Show "users da empresa" $r
$r = Call POST "/users" @{ name = "Atendente"; email = "at$suffix@teste.com"; password = "senha123"; profile = "user" } $admin; Show "cria usuario" $r
$userId = ($r.Body | ConvertFrom-Json).id
$r = Call POST "/users" @{ name = "Atendente"; email = "at$suffix@teste.com"; password = "senha123"; profile = "user" } $admin; Show "cria usuario duplicado" $r
$r = Call PUT "/users/$userId" @{ name = "Atendente Editado"; email = "at$suffix@teste.com" } $admin; Show "edita usuario" $r
$r = Call GET "/users/$userId" $null $admin; Show "mostra usuario" $r

$r = Call POST "/permission-groups" @{ name = "Atendimento"; permissions = @("tickets:view", "nao:existe") } $admin; Show "cria grupo" $r
$groupId = ($r.Body | ConvertFrom-Json).id
$r = Call PUT "/users/$userId" @{ permissionGroupId = $groupId } $admin; Show "usuario no grupo" $r
$r = Call GET "/permission-groups/user/$userId" $null $admin; Show "permissoes do usuario" $r

$r = Call POST "/auth/login" @{ email = "at$suffix@teste.com"; password = "senha123" }; Show "login atendente" $r
$atendente = ($r.Body | ConvertFrom-Json).token
$r = Call GET "/users" $null $atendente; Show "atendente lista users (403)" $r

$r = Call DELETE "/permission-groups/$groupId" $null $admin; Show "remove grupo em uso (400)" $r
$r = Call DELETE "/users/$userId" $null $admin; Show "remove usuario" $r
$r = Call GET "/company/branding" $null $admin; Show "branding" $r
$r = Call GET "/permission-groups/modules" $null $admin; Show "modulos" $r
$r = Call DELETE "/auth/logout" $null $admin; Show "logout" $r
