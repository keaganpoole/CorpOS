$key = $env:SUPABASE_ANON_KEY
$url = $env:SUPABASE_URL
$headers = @{
    'apikey' = $key
    'Authorization' = "Bearer $key"
    'Content-Type' = 'application/json'
}
$body = @{
    'status' = 'completed'
    'completion_date' = '2026-04-09T03:01:00Z'
    'updated_by' = 'Yanna'
} | ConvertTo-Json -Depth 3

try {
    $r = Invoke-RestMethod -Uri "$url/rest/v1/tasks?id=eq.40a438f9-4c6c-4bf5-a1c0-86150c4a9f7c" -Headers $headers -Method PATCH -Body $body
    Write-Output "Task completed successfully"
    $r | ConvertTo-Json -Depth 3
} catch {
    Write-Error "Error: $_"
    $errBody = $_.ErrorDetails.Message
    if ($errBody) { Write-Error "Details: $errBody" }
}
