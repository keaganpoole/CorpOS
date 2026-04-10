param([string]$Fields)
Write-Host "Fields received: $Fields"
Write-Host "Length: $($Fields.Length)"
# try to parse
try {
    $obj = $Fields | ConvertFrom-Json
    Write-Host "Parsed successfully"
    $obj | ConvertTo-Json
} catch {
    Write-Host "Error: $_"
}