$headers = @{ 'apikey' = $env:SUPABASE_ANON_KEY; 'Authorization' = 'Bearer ' + $env:SUPABASE_ANON_KEY; 'Content-Type' = 'application/json' }
$body = @{ 'status' = 'working'; 'updated_by' = 'Yanna' } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://jspksetkrprvomilgtyj.supabase.co/rest/v1/tasks?id=eq.4b064d5b-6a83-4ea1-a902-6812b66f284d' -Headers $headers -Method PATCH -Body $body
Write-Output "Task updated"