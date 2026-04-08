param([string]$Content)
$webhookUrl = $env:DISCORD_WEBHOOK_YANNA
$body = @{ content = $Content }
Invoke-RestMethod -Uri $webhookUrl -Method POST -Body ($body | ConvertTo-Json) -ContentType "application/json"
Write-Output "Message sent via webhook."