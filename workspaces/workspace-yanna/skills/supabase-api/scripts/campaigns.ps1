param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('list','get','update','assign')]
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
    'update' {
        if (-not $Id) { Write-Error "-Id required for update"; exit 1 }
        $body = @{}
        if ($Status) { $body['Status'] = $Status }
        if ($AssignedTo) { $body['assigned_to'] = $AssignedTo }
        if ($Fields) { ($Fields | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $body[$_.Name] = $_.Value } }
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/research_campaigns?id=eq.$Id" -Headers $Headers -Method PATCH -Body ($body | ConvertTo-Json)
        Write-Output "Updated campaign $Id"
    }
    'assign' {
        if (-not $Id -or -not $AssignedTo) { Write-Error "-Id and -AssignedTo required for assign"; exit 1 }
        $body = @{ 'Status' = 'Assigned'; 'assigned_to' = $AssignedTo; 'updated_by' = $AssignedTo }
        Invoke-RestMethod -Uri "$Url/rest/v1/research_campaigns?id=eq.$Id" -Headers $Headers -Method PATCH -Body ($body | ConvertTo-Json) | Out-Null
        Write-Output "Assigned campaign $Id to $AssignedTo"
    }
}
