param($Fields)
Write-Host "Fields: $Fields"
Write-Host "Fields length: $($Fields.Length)"
# try to parse with ConvertFrom-Json
$obj = $Fields | ConvertFrom-Json
Write-Host "Parsed"