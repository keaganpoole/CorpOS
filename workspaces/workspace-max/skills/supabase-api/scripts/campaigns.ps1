param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('list','get','create','update','assign','unassign')]
    [string]$Action,
    [string]$Id,
    [string]$Status,
    [string]$AssignedTo,
    [string]$Fields
)

$Url = $env:SUPABASE_URL
$Key = $env:SUPABASE_ANON_KEY
if (-not $Url -or -not $Key) { Write-Error "Missing SUPABASE_URL or SUPABASE_ANON_KEY"; exit 1 }
$Headers = @{ "apikey"=$Key; "Authorization"="Bearer $Key"; "Content-Type"="application/json" }

switch ($Action) {
    'list' {
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/research_campaigns?select=*&order=created_at.desc" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'get' {
        if (-not $Id) { Write-Error "-Id required for get"; exit 1 }
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/research_campaigns?id=eq.$Id&select=*" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'create' {
        if (-not $Fields) { Write-Error "-Fields (JSON) required for create"; exit 1 }
        $body = $Fields | ConvertFrom-Json
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/research_campaigns" -Headers $Headers -Method POST -Body ($body | ConvertTo-Json -Depth 5)
        Write-Output "Created campaign"
    }
    'update' {
        if (-not $Id) { Write-Error "-Id required for update"; exit 1 }
        $body = @{}
        if ($Status) { $body['Status'] = $Status }
        if ($AssignedTo) { $body['assigned_to'] = $AssignedTo }
        if ($Fields) { ($Fields | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $body[$_.Name] = $_.Value } }
        Invoke-RestMethod -Uri "$Url/rest/v1/research_campaigns?id=eq.$Id" -Headers $Headers -Method PATCH -Body ($body | ConvertTo-Json -Depth 5) | Out-Null
        Write-Output "Updated campaign $Id"
    }
    'assign' {
        if (-not $Id -or -not $AssignedTo) { Write-Error "-Id and -AssignedTo required"; exit 1 }
        $body = @{ 'Status'='Assigned'; 'assigned_to'=$AssignedTo; 'updated_by'='Max' }
        Invoke-RestMethod -Uri "$Url/rest/v1/research_campaigns?id=eq.$Id" -Headers $Headers -Method PATCH -Body ($body | ConvertTo-Json) | Out-Null
        Write-Output "Assigned campaign $Id to $AssignedTo"
    }
    'unassign' {
        if (-not $Id) { Write-Error "-Id required"; exit 1 }
        $body = @{ 'Status'='Unassigned'; 'assigned_to'=$null; 'updated_by'='Max' }
        Invoke-RestMethod -Uri "$Url/rest/v1/research_campaigns?id=eq.$Id" -Headers $Headers -Method PATCH -Body ($body | ConvertTo-Json) | Out-Null
        Write-Output "Unassigned campaign $Id"
    }
}
