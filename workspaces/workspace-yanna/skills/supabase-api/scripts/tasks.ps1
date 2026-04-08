param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('list','get','create','update')]
    [string]$Action,
    [string]$Id,
    [string]$Team,
    [string]$Status,
    [string]$Fields
)

$Url = $env:SUPABASE_URL
$Key = $env:SUPABASE_ANON_KEY
if (-not $Url -or -not $Key) { Write-Error "Missing SUPABASE_URL or SUPABASE_ANON_KEY"; exit 1 }
$Headers = @{ "apikey"=$Key; "Authorization"="Bearer $Key"; "Content-Type"="application/json" }

switch ($Action) {
    'list' {
        $filter = "select=*&order=created_at.desc"
        if ($Team) { $filter = "assigned_team=eq.$Team&$filter" }
        if ($Status) { $filter = "status=eq.$Status&$filter" }
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/tasks?$filter" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'get' {
        if (-not $Id) { Write-Error "-Id required for get"; exit 1 }
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/tasks?id=eq.$Id&select=*" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'create' {
        if (-not $Fields) { Write-Error "-Fields (JSON) required for create"; exit 1 }
        $body = $Fields | ConvertFrom-Json
        $json = $body | ConvertTo-Json -Depth 5
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/tasks" -Headers $Headers -Method POST -Body $json
        Write-Output "Created task: $($body.task)"
    }
    'update' {
        if (-not $Id) { Write-Error "-Id required for update"; exit 1 }
        if (-not $Fields) { Write-Error "-Fields (JSON) required for update"; exit 1 }
        $body = $Fields | ConvertFrom-Json
        $json = $body | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "$Url/rest/v1/tasks?id=eq.$Id" -Headers $Headers -Method PATCH -Body $json | Out-Null
        Write-Output "Updated task $Id"
    }
}
