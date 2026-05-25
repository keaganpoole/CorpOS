$Url = $env:SUPABASE_URL
$Key = $env:SUPABASE_ANON_KEY
if (-not $Url -or -not $Key) { Write-Error "Missing SUPABASE_URL or SUPABASE_ANON_KEY"; exit 1 }

$Headers = @{ "apikey"=$Key; "Authorization"="Bearer $Key" }

$uri = "$Url/rest/v1/leads?limit=5"
$r = Invoke-RestMethod -Uri $uri -Headers $Headers
Write-Output "Response:"
Write-Output "Type of r: $($r.GetType().FullName)"
Write-Output "Count: $($r.Count)"
Write-Output "r is array: $($r -is [array])"
Write-Output "r is null: $($r -eq $null)"
Write-Output "Array count: $($r.Length)"
if ($r.Count -gt 0) {
    Write-Output "Value: $r"
    Write-Output ($r | ConvertTo-Json -Depth 5)
} else {
    Write-Output "Empty array returned"
}