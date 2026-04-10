$headers = @{ 'apikey' = $env:SUPABASE_ANON_KEY; 'Authorization' = 'Bearer ' + $env:SUPABASE_ANON_KEY; 'Content-Type' = 'application/json' }
$subtasks = @(
    @{
        id = "st-1"
        task = "Pull campaign criteria"
        status = "completed"
        assigned_to = "Yanna"
        completed_at = "2026-04-09T20:22:00Z"
    },
    @{
        id = "st-2"
        task = "Search for leads"
        status = "in progress"
        assigned_to = "Yanna"
        completed_at = $null
    },
    @{
        id = "st-3"
        task = "Audit websites"
        status = "queued"
        assigned_to = "Yanna"
        completed_at = $null
    },
    @{
        id = "st-4"
        task = "Save qualified leads"
        status = "queued"
        assigned_to = "Yanna"
        completed_at = $null
    }
)
$body = @{ 'subtasks' = $subtasks; 'updated_by' = 'Yanna' } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri 'https://jspksetkrprvomilgtyj.supabase.co/rest/v1/tasks?id=eq.4b064d5b-6a83-4ea1-a902-6812b66f284d' -Headers $headers -Method PATCH -Body $body
Write-Output "Subtasks updated"