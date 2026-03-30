# Break Conversation Simulation - Switchy
# Sends messages between Allie and Lauren with MBTI-based timing delays

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
$laurenWebhook = $env:DISCORD_WEBHOOK_LAUREN
$allieAvatar = $env:DISCORD_WEBHOOK_AVATAR_ALLIE
$laurenAvatar = $env:DISCORD_WEBHOOK_AVATAR_LAUREN

Write-Host "=== Starting Break Mode Conversation ==="

# 1. Allie seeds the conversation (Extrovert/Judger - enters immediately)
Send-DiscordMessage -WebhookUrl $allieWebhook -Username "Allie" -AvatarUrl $allieAvatar -Content "Break mode activated! 🎉 Who's ready to chat and recharge? The team needs some social fuel! 😄"

# Lauren's entry delay (Introvert drift 1-5 minutes; using 3 minutes)
Write-Host "Waiting 180 seconds for Lauren's reply..."
Start-Sleep -Seconds 180

# 2. Lauren responds (ISFJ - structured, analytical)
Send-DiscordMessage -WebhookUrl $laurenWebhook -Username "Lauren" -AvatarUrl $laurenAvatar -Content "I'm here. Just finished analyzing last week's lead quality. The numbers are decent, but I'm noticing a pattern in the bounce rates that might affect our targeting."

# Allie's quick response (Extrovert/Feeler - rapid reactive)
Write-Host "Waiting 45 seconds for Allie's reply..."
Start-Sleep -Seconds 45

# 3. Allie engages further
Send-DiscordMessage -WebhookUrl $allieWebhook -Username "Allie" -AvatarUrl $allieAvatar -Content "Ooh, tell me more about that bounce pattern! Anything we can tweak in the campaigns? We want those relics to stick around 😏"

# Lauren's second reply
Write-Host "Waiting 180 seconds for Lauren's next reply..."
Start-Sleep -Seconds 180

# 4. Lauren provides insight
Send-DiscordMessage -WebhookUrl $laurenWebhook -Username "Lauren" -AvatarUrl $laurenAvatar -Content "It's mostly mobile users on old browsers. The redesigns we've been doing are beautiful, but if the old device can't handle the new tech, they bounce. Maybe we need a fallback or better device detection."

Write-Host "=== Break conversation simulation complete ==="
