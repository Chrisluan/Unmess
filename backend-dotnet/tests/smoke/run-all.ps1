Get-ChildItem -Path $PSScriptRoot -Filter *.ps1 |
    Where-Object { $_.Name -notin @("lib.ps1", "run-all.ps1") } |
    ForEach-Object {
        "=== $($_.BaseName)"
        & $_.FullName
    }
