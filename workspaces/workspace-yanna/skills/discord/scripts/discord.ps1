param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('send')]
    [string]$Action,
    [string]$Content,
    [string]$WebhookUrl
)

# Default to Team CorpOS webhook
if (-not $WebhookUrl) { $WebhookUrl = $env:DISCORD_WEBHOOK_YANNA }
if (-not $WebhookUrl) { Write-Error "Missing webhook URL (pass -WebhookUrl or set DISCORD_WEBHOOK_YANNA)"; exit 1 }

switch ($Action) {
    'send' {
        if (-not $Content) { Write-Error "-Content required"; exit 1 }
        $body = @{ content = $Content }
        $r = Invoke-RestMethod -Uri $WebhookUrl -Method POST -Body ($body | ConvertTo-Json) -ContentType "application/json"
        Write-Output "Sent webhook message"
    }
}
