$taskId = "83188e13-f80a-49bf-93d5-e214fe36e122"
$url = $env:SUPABASE_URL
$key = $env:SUPABASE_ANON_KEY
$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
}
$body = @{
    status = "in progress"
    updated_by = "Yanna"
} | ConvertTo-Json
Write-Host "Sending body: $body"
$response = Invoke-RestMethod -Uri "$url/rest/v1/tasks?id=eq.$taskId" -Headers $headers -Method PATCH -Body $body
Write-Host "Response: $response"