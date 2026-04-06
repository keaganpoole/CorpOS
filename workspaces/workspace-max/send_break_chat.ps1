# Break Chat - Yanna
# Sends a message as Yanna in Team CorpOS

$json = '{"content": "Happy Saturday team! Hope you are all enjoying your weekends!"}'
Invoke-WebRequest -Uri $env:DISCORD_WEBHOOK_YANNA -Method POST -ContentType "application/json" -Body $json
