$url = $env:SUPABASE_URL
$key = $env:SUPABASE_ANON_KEY
$headers = @{ 'apikey' = $key; 'Content-Type' = 'application/json' }
$body = @{ status = 'working'; updated_by = 'Yanna' } | ConvertTo-Json
Write-Host "Body: $body"
$r = Invoke-RestMethod -Uri "$url/rest/v1/tasks?id=eq.621c59a3-bc68-4e3c-81de-83a393424e83" -Headers $headers -Method PATCH -Body $body
Write-Host 'Updated'