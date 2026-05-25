param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('list','get','create','update','search','check-duplicate')]
    [string]$Action,
    [string]$Id,
    [string]$Company,
    [string]$State,
    [string]$Fields,
    [int]$Limit = 50
)

$Url = $env:SUPABASE_URL
$Key = $env:SUPABASE_ANON_KEY
if (-not $Url -or -not $Key) { Write-Error "Missing SUPABASE_URL or SUPABASE_ANON_KEY"; exit 1 }
$Headers = @{ "apikey"=$Key; "Authorization"="Bearer $Key"; "Content-Type"="application/json" }

switch ($Action) {
    'list' {
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/leads?select=*&order=created_at.desc&limit=$Limit" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'get' {
        if (-not $Id) { Write-Error "-Id required for get"; exit 1 }
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/leads?id=eq.$Id&select=*" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'create' {
        if (-not $Fields) { Write-Error "-Fields (JSON) required for create"; exit 1 }
        $body = $Fields | ConvertFrom-Json
        $json = $body | ConvertTo-Json -Depth 5
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/leads" -Headers $Headers -Method POST -Body $json
        Write-Output "Created lead: $($body.company)"
    }
    'update' {
        if (-not $Id) { Write-Error "-Id required for update"; exit 1 }
        if (-not $Fields) { Write-Error "-Fields (JSON) required for update"; exit 1 }
        $body = $Fields | ConvertFrom-Json
        $json = $body | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "$Url/rest/v1/leads?id=eq.$Id" -Headers $Headers -Method PATCH -Body $json | Out-Null
        Write-Output "Updated lead $Id"
    }
    'search' {
        if (-not $Company) { Write-Error "-Company required for search"; exit 1 }
        $encoded = [uri]::EscapeDataString($Company)
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/leads?company=ilike.*$encoded*&select=id,company,state,status,industry,page_quality_score,created_at&order=created_at.desc&limit=$Limit" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'check-duplicate' {
        if (-not $Company -or -not $State) { Write-Error "-Company and -State required for check-duplicate"; exit 1 }
        $encodedCo = [uri]::EscapeDataString($Company)
        $encodedSt = [uri]::EscapeDataString($State)
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/leads?company=ilike.$encodedCo&state=eq.$encodedSt&select=id,company,state" -Headers $Headers
        if ($r.Count -gt 0) {
            Write-Output "DUPLICATE: $($r[0].company) in $($r[0].state) already exists (id: $($r[0].id))"
        } else {
            Write-Output "NO_DUPLICATE"
        }
    }
}
