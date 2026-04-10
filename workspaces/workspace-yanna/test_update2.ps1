$Url = $env:SUPABASE_URL
$Key = $env:SUPABASE_ANON_KEY
if (-not $Url -or -not $Key) { Write-Error "Missing SUPABASE_URL or SUPABASE_ANON_KEY"; exit 1 }

$Id = "621c59a3-bc68-4e3c-81de-83a393424e83"
$Headers = @{ "apikey"=$Key; "Authorization"="Bearer $Key"; "Content-Type"="application/json" }

$json = Get-Content -Path "C:\Users\vboxuser\.openclaw\workspaces\workspace-yanna\update_task.json" -Raw
Write-Output "JSON body: $json"
Invoke-RestMethod -Uri "$Url/rest/v1/tasks?id=eq.$Id" -Headers $Headers -Method PATCH -Body $json | Out-Null
Write-Output "Updated task $Id"