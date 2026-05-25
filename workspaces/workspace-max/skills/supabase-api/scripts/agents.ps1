param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('list','get','update')]
    [string]$Action,
    [string]$Id,
    [string]$Fields
)

$Url = $env:SUPABASE_URL
$Key = $env:SUPABASE_ANON_KEY
if (-not $Url -or -not $Key) { Write-Error "Missing SUPABASE_URL or SUPABASE_ANON_KEY"; exit 1 }
$Headers = @{ "apikey"=$Key; "Authorization"="Bearer $Key"; "Content-Type"="application/json" }

switch ($Action) {
    'list' {
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/agents?select=*&order=hierarchy_level" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'get' {
        if (-not $Id) { Write-Error "-Id required for get"; exit 1 }
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/agents?id=eq.$Id&select=*" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'update' {
        if (-not $Id) { Write-Error "-Id required for update"; exit 1 }
        if (-not $Fields) { Write-Error "-Fields (JSON) required for update"; exit 1 }
        Invoke-RestMethod -Uri "$Url/rest/v1/agents?id=eq.$Id" -Headers $Headers -Method PATCH -Body $Fields | Out-Null
        Write-Output "Updated agent $Id"
    }
}
