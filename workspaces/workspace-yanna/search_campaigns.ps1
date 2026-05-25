$url = $env:SUPABASE_URL
$key = $env:SUPABASE_ANON_KEY
$headers = @{ 'apikey' = $key }
# encode space
$encoded = [uri]::EscapeDataString('Target Industry')
$uri = "$url/rest/v1/research_campaigns?select=*&$encoded=ilike.*Mechanics*"
Write-Host "URI: $uri"
$r = Invoke-RestMethod -Uri $uri -Headers $headers
$r | ConvertTo-Json -Depth 5