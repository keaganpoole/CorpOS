$url = $env:SUPABASE_URL
$key = $env:SUPABASE_ANON_KEY
$headers = @{ 'apikey' = $key }
$r = Invoke-RestMethod -Uri "$url/rest/v1/tasks?id=eq.621c59a3-bc68-4e3c-81de-83a393424e83&select=*" -Headers $headers
$r | ConvertTo-Json -Depth 5