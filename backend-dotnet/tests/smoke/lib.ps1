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

function New-CompanyAdmin {
    $super = (Json (Call POST "/auth/login" @{ email = "super@whaticket.com"; password = "super123" })).token
    $suffix = Get-Random
    $created = Json (Call POST "/companies" @{ name = "Empresa $suffix"; adminName = "Admin"; adminEmail = "admin$suffix@teste.com"; adminPassword = "senha123" } $super)
    $token = (Json (Call POST "/auth/login" @{ email = "admin$suffix@teste.com"; password = "senha123" })).token
    return @{ Token = $token; CompanyId = $created.company.id; Suffix = $suffix }
}
