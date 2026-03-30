$json = '{"content": "Happy Saturday team! Hope you are all enjoying your weekends!"}'
Invoke-WebRequest -Uri $env:DISCORD_WEBHOOK_LAUREN -Method POST -ContentType "application/json" -Body $json