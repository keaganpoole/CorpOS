param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('log','list')]
    [string]$Action,
    [string]$AgentName,
    [ValidateSet('compliment','complaint')]
    [string]$Type,
    [string]$Context
)

$Url = $env:SUPABASE_URL
$Key = $env:SUPABASE_ANON_KEY
if (-not $Url -or -not $Key) { Write-Error "Missing SUPABASE_URL or SUPABASE_ANON_KEY"; exit 1 }
$Headers = @{ "apikey"=$Key; "Authorization"="Bearer $Key"; "Content-Type"="application/json" }

switch ($Action) {
    'log' {
        if (-not $AgentName -or -not $Type) { Write-Error "-AgentName and -Type required for log"; exit 1 }
        $body = @{ agent_name=$AgentName; reaction_type=$Type }
        if ($Context) { $body['context'] = $Context }
        Invoke-RestMethod -Uri "$Url/rest/v1/reactions" -Headers $Headers -Method POST -Body ($body | ConvertTo-Json) | Out-Null
        Write-Output "Logged $Type for $AgentName"
    }
    'list' {
        $filter = "select=*&order=created_at.desc"
        if ($AgentName) { $filter = "agent_name=eq.$AgentName&$filter" }
        $r = Invoke-RestMethod -Uri "$Url/rest/v1/reactions?$filter" -Headers $Headers
        $r | ConvertTo-Json -Depth 5
    }
}
