param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('list','get','update','search','stats')]
    [string]$Action,
    [string]$Id,
    [string]$Company,
    [string]$State,
    [string]$Status,
    [string]$Fields,
    [int]$Limit = 50
)

$Url = $env:SUPABASE_URL
$Key = $env:SUPABASE_ANON_KEY
if (-not $Url -or -not $Key) { Write-Error "Missing SUPABASE_URL or SUPABASE_ANON_KEY"; exit 1 }
$Headers = @{ "apikey"=$Key; "Authorization"="Bearer $Key"; "Content-Type"="application/json" }

switch ($Action) {
    'list' {
        $filter = "select=*&order=created_at.desc&limit=$Limit"
        if ($Status) { $filter = "status=eq.$Status&$filter" }
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/leads?$filter" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'get' {
        if (-not $Id) { Write-Error "-Id required for get"; exit 1 }
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/leads?id=eq.$Id&select=*" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'update' {
        if (-not $Id) { Write-Error "-Id required for update"; exit 1 }
        if (-not $Fields) { Write-Error "-Fields (JSON) required for update"; exit 1 }
        $body = $Fields | ConvertFrom-Json
        Invoke-RestMethod -Uri "$Url/rest/v1/leads?id=eq.$Id" -Headers $Headers -Method PATCH -Body ($body | ConvertTo-Json -Depth 5) | Out-Null
        Write-Output "Updated lead $Id"
    }
    'search' {
        if (-not $Company) { Write-Error "-Company required for search"; exit 1 }
        $encoded = [uri]::EscapeDataString($Company)
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/leads?company=ilike.*$encoded*&select=id,company,state,status,industry,page_quality_score,created_by&order=created_at.desc&limit=$Limit" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
    'stats' {
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/leads?select=id,status,page_quality_score,created_by&order=created_at.desc" -Headers $Headers
        $total = $r.Count
        $byStatus = $r | Group-Object status | ForEach-Object { @{ status = $_.Name; count = $_.Count } }
        $avgScore = ($r | Where-Object { $_.page_quality_score -ne $null } | Measure-Object -Property page_quality_score -Average).Average
        @{ total_leads=$total; by_status=$byStatus; avg_page_quality_score=[math]::Round($avgScore,1) } | ConvertTo-Json -Depth 5
    }
}
