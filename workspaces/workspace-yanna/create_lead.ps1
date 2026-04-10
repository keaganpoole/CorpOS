$Url = $env:SUPABASE_URL
$Key = $env:SUPABASE_ANON_KEY
if (-not $Url -or -not $Key) { Write-Error "Missing SUPABASE_URL or SUPABASE_ANON_KEY"; exit 1 }

$Headers = @{ "apikey"=$Key; "Authorization"="Bearer $Key"; "Content-Type"="application/json" }

$json = Get-Content -Path "C:\Users\vboxuser\.openclaw\workspaces\workspace-yanna\new_lead.json" -Raw
Write-Output "JSON body: $json"
$r = Invoke-RestMethod -Uri "$Url/rest/v1/leads" -Headers $Headers -Method POST -Body $json
Write-Output "Created lead: $($r.company)"