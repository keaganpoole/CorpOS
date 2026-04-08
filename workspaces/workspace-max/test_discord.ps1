$headers = @{ 'Authorization' = "Bot $env:DISCORD_BOT_TOKEN_MAX" }
$response = Invoke-WebRequest -Uri 'https://discord.com/api/v10/users/@me' -Headers $headers -Method Get
$response.Content