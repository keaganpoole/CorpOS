$key = $env:SUPABASE_ANON_KEY
$url = $env:SUPABASE_URL
$headers = @{
    'apikey' = $key
    'Authorization' = "Bearer $key"
    'Content-Type' = 'application/json'
}
$body = @{
    'status' = 'idle'
    'current_activity' = ''
} | ConvertTo-Json -Depth 3

try {
    Invoke-RestMethod -Uri "$url/rest/v1/agents?id=eq.yanna" -Headers $headers -Method PATCH -Body $body | Out-Null
    Write-Output "Agent status updated to idle"
} catch {
    Write-Error "Error: $_"
}
