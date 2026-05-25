$url = $env:SUPABASE_URL
$key = $env:SUPABASE_ANON_KEY
$headers = @{ 'apikey' = $key; 'Content-Type' = 'application/json' }
$subtasks = @(
    @{
        id = 'st-1'
        task = 'Research Mechanics in Worcester'
        status = 'pending'
        assigned_to = 'Yanna'
    }
)
$body = @{ subtasks = $subtasks; updated_by = 'Yanna' } | ConvertTo-Json -Depth 5
Write-Host "Body: $body"
$r = Invoke-RestMethod -Uri "$url/rest/v1/tasks?id=eq.621c59a3-bc68-4e3c-81de-83a393424e83" -Headers $headers -Method PATCH -Body $body
Write-Host 'Updated subtasks'