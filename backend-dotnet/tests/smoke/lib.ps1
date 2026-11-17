$base = if ($env:UNMESS_API_URL) { $env:UNMESS_API_URL } else { "http://localhost:5240" }
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Call($method, $path, $body = $null, $token = $null) {
    $headers = @{}
    if ($token) { $headers.Authorization = "Bearer $token" }
    $params = @{ Method = $method; Uri = "$base$path"; Headers = $headers; WebSession = $session; UseBasicParsing = $true; ContentType = "application/json; charset=utf-8" }
    if ($null -ne $body) { $params.Body = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 6)) }
    try {
        $r = Invoke-WebRequest @params
        $content = if ($r.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($r.Content) } else { [string]$r.Content }
        return @{ Status = [int]$r.StatusCode; Body = $content }
    } catch {
        $resp = $_.Exception.Response
        if (-not $resp) { return @{ Status = 0; Body = $_.Exception.Message } }
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        return @{ Status = [int]$resp.StatusCode; Body = $reader.ReadToEnd() }
    }
}

function Show($label, $result, $expected) {
    $ok = if ($expected) { if ($result.Status -eq $expected) { "ok " } else { "XX " } } else { "   " }
    "{0}{1,-36} {2} {3}" -f $ok, $label, $result.Status, ($result.Body.Substring(0, [Math]::Min(150, $result.Body.Length)))
}

function Json($result) { $result.Body | ConvertFrom-Json }

function Read-DevEnv {
    $values = @{}
    Get-Content (Join-Path $PSScriptRoot "..\..\..\.env") | ForEach-Object { if ($_ -match '^([A-Z_]+)=(.*)$') { $values[$Matches[1]] = $Matches[2] } }
    return $values
}

function Invoke-DevSql([string]$sql) {
    $sql | docker exec -i unmess-dev-mysql-1 sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" --batch --skip-column-names 2>/dev/null'
}

function Add-ConnectedWhatsapp([int]$companyId) {
    $id = Invoke-DevSql "INSERT INTO Whatsapps (name, status, isDefault, retries, companyId, createdAt, updatedAt) VALUES ('Simulado $companyId', 'CONNECTED', 1, 0, $companyId, NOW(), NOW()); SELECT LAST_INSERT_ID();"
    $id = [int]($id | Select-Object -Last 1)
    $envValues = Read-DevEnv
    $headers = @{ Authorization = "Bearer $($envValues.GATEWAY_API_TOKEN)" }
    $gateway = "http://localhost:$($envValues.GATEWAY_PORT)"
    Invoke-RestMethod -Method Post "$gateway/v1/sessions/$id/connect" -Headers $headers | Out-Null
    for ($i = 0; $i -lt 30; $i++) {
        if ((Invoke-RestMethod "$gateway/v1/sessions/$id" -Headers $headers).status -eq "connected") { break }
        Start-Sleep -Milliseconds 200
    }
    return $id
}

function New-TestImage {
    Add-Type -AssemblyName System.Drawing
    $path = Join-Path $env:TEMP "unmess-smoke-$(Get-Random).png"
    $bitmap = New-Object System.Drawing.Bitmap 300, 200
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Orange)
    $graphics.Dispose()
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    return $path
}

function Fake-Inbound([int]$sessionId, $body) {
    $envValues = Read-DevEnv
    $headers = @{ Authorization = "Bearer $($envValues.GATEWAY_API_TOKEN)" }
    $json = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json))
    return Invoke-RestMethod -Method Post "http://localhost:$($envValues.GATEWAY_PORT)/v1/fake/sessions/$sessionId/inbound" -Headers $headers -ContentType "application/json; charset=utf-8" -Body $json
}

function Upload($path, $fields, $file, $contentType, $token, [string]$Field = "file") {
    Add-Type -AssemblyName System.Net.Http
    $client = New-Object System.Net.Http.HttpClient
    $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token)
    $form = New-Object System.Net.Http.MultipartFormDataContent
    foreach ($key in $fields.Keys) { $form.Add((New-Object System.Net.Http.StringContent([string]$fields[$key])), $key) }
    $bytes = New-Object System.Net.Http.ByteArrayContent(,[System.IO.File]::ReadAllBytes($file))
    $bytes.Headers.ContentType = New-Object System.Net.Http.Headers.MediaTypeHeaderValue($contentType)
    $form.Add($bytes, $Field, [System.IO.Path]::GetFileName($file))
    $response = $client.PostAsync("$base$path", $form).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $client.Dispose()
    return @{ Status = [int]$response.StatusCode; Body = $body }
}

function New-CompanyAdmin {
    $super = (Json (Call POST "/auth/login" @{ email = "super@whaticket.com"; password = "super123" })).token
    $suffix = Get-Random
    $created = Json (Call POST "/companies" @{ name = "Empresa $suffix"; adminName = "Admin"; adminEmail = "admin$suffix@teste.com"; adminPassword = "senha123" } $super)
    $token = (Json (Call POST "/auth/login" @{ email = "admin$suffix@teste.com"; password = "senha123" })).token
    return @{ Token = $token; CompanyId = $created.company.id; Suffix = $suffix }
}
