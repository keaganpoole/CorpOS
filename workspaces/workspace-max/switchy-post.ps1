# Break Conversation Simulation - Switchy
# Sends messages between Allie and Yanna with MBTI-based timing delays

function Send-DiscordMessage {
    param(
        [string]$WebhookUrl,
        [string]$Username,
        [string]$AvatarUrl,
        [string]$Content
    )
    $body = @{
        username = $Username
        avatar_url = $AvatarUrl
        content = $Content
    } | ConvertTo-Json
    try {
        $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body $utf8Bytes -ContentType 'application/json' | Out-Null
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sent message as $Username"
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Failed to send message as $Username`: $_"
        Write-Host "JSON payload: $body"
    }
}

# Read webhook URLs and avatars from environment
$allieWebhook = $env:DISCORD_WEBHOOK_ALLIE
$yannaWebhook = $env:DISCORD_WEBHOOK_YANNA
$allieAvatar = $env:DISCORD_WEBHOOK_AVATAR_ALLIE
$yannaAvatar = $env:DISCORD_WEBHOOK_AVATAR_YANNA

Write-Host "=== Starting Break Mode Conversation ==="

# 1. Allie seeds the conversation (Extrovert/Judger - enters immediately)
Send-DiscordMessage -WebhookUrl $allieWebhook -Username "Allie" -AvatarUrl $allieAvatar -Content "Break mode activated! 🎉 Who's ready to chat and recharge? The team needs some social fuel! 😄"

# Yanna's entry delay (INFP — takes a moment to warm up, 3 minutes)
Write-Host "Waiting 180 seconds for Yanna's reply..."
Start-Sleep -Seconds 180

# 2. Yanna responds (INFP - thoughtful, observant)
Send-DiscordMessage -WebhookUrl $yannaWebhook -Username "Yanna" -AvatarUrl $yannaAvatar -Content "I'm here! Just wrapped up scanning some leads — found a few gems hiding in the rough. The kind that make you go 'oh, you NEED us.' 😏"

# Allie's quick response (Extrovert/Feeler - rapid reactive)
Write-Host "Waiting 45 seconds for Allie's reply..."
Start-Sleep -Seconds 45

# 3. Allie engages further
Send-DiscordMessage -WebhookUrl $allieWebhook -Username "Allie" -AvatarUrl $allieAvatar -Content "Ooh, tell me more about those leads! Anything we can run with for the next campaign? We want those relics to stick around 😏"

# Yanna's second reply
Write-Host "Waiting 180 seconds for Yanna's next reply..."
Start-Sleep -Seconds 180

# 4. Yanna provides insight
Send-DiscordMessage -WebhookUrl $yannaWebhook -Username "Yanna" -AvatarUrl $yannaAvatar -Content "A couple of them have sites that haven't been updated since 2015. Broken contact forms, Flash elements still loading — basically digital fossils. Max is going to love these."

Write-Host "=== Break conversation simulation complete ==="
