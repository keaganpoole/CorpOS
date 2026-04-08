$headers = @{ 'Authorization' = "Bot $env:DISCORD_BOT_TOKEN_MAX" }
$guildId = "1487306966484258887"
$uri = "https://discord.com/api/v10/guilds/$guildId/channels"
try {
    $response = Invoke-WebRequest -Uri $uri -Headers $headers -Method Get -ErrorAction Stop
    $channels = $response.Content | ConvertFrom-Json
    $channels | ForEach-Object { "$($_.id) - $($_.name)" }
} catch {
    Write-Error $_.Exception.Message
}