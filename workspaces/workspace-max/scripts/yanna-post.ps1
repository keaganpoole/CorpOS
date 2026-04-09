$wh = $env:DISCORD_WEBHOOK_YANNA
if (-not $wh) { Write-Error "Missing DISCORD_WEBHOOK_YANNA"; exit 1 }
$body = @{ content = "Hey team, Yanna here - online and ready. What are we working on?" } | ConvertTo-Json
Invoke-RestMethod -Uri $wh -Method Post -Body $body -ContentType 'application/json'
Write-Output "Sent successfully"
