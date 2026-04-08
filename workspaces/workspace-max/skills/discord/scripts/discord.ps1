param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('send','reply','react','delete','history')]
    [string]$Action,
    [string]$ChannelId,
    [string]$MessageId,
    [string]$Content,
    [string]$Emoji,
    [int]$Limit = 10
)

$Token = $env:DISCORD_BOT_TOKEN_MAX
if (-not $Token) { Write-Error "Missing DISCORD_BOT_TOKEN_MAX"; exit 1 }
$Headers = @{ "Authorization"="Bot $Token"; "Content-Type"="application/json" }
$Base = "https://discord.com/api/v10"

try {
    switch ($Action) {
        'send' {
            if (-not $ChannelId -or -not $Content) { Write-Error "-ChannelId and -Content required"; exit 1 }
            $body = @{ content = $Content }
            $r = Invoke-RestMethod -Uri "$Base/channels/$ChannelId/messages" -Headers $Headers -Method POST -Body ($body | ConvertTo-Json)
            Write-Output "Sent (msg: $($r.id))"
        }
        'reply' {
            if (-not $ChannelId -or -not $MessageId -or -not $Content) { Write-Error "-ChannelId, -MessageId, and -Content required"; exit 1 }
            $body = @{ content = $Content; message_reference = @{ message_id = $MessageId; channel_id = $ChannelId } }
            $r = Invoke-RestMethod -Uri "$Base/channels/$ChannelId/messages" -Headers $Headers -Method POST -Body ($body | ConvertTo-Json)
            Write-Output "Replied to $MessageId (msg: $($r.id))"
        }
        'react' {
            if (-not $ChannelId -or -not $MessageId -or -not $Emoji) { Write-Error "-ChannelId, -MessageId, and -Emoji required"; exit 1 }
            $encodedEmoji = [uri]::EscapeDataString($Emoji)
            Invoke-RestMethod -Uri "$Base/channels/$ChannelId/messages/$MessageId/reactions/$encodedEmoji/@me" -Headers $Headers -Method PUT | Out-Null
            Write-Output "Reacted $Emoji to $MessageId"
        }
        'delete' {
            if (-not $ChannelId -or -not $MessageId) { Write-Error "-ChannelId and -MessageId required"; exit 1 }
            Invoke-RestMethod -Uri "$Base/channels/$ChannelId/messages/$MessageId" -Headers $Headers -Method DELETE | Out-Null
            Write-Output "Deleted message $MessageId"
        }
        'history' {
            if (-not $ChannelId) { Write-Error "-ChannelId required"; exit 1 }
            $r = Invoke-RestMethod -Uri "$Base/channels/$ChannelId/messages?limit=$Limit" -Headers $Headers
            $r | ForEach-Object { @{ id=$_.id; author=$_.author.username; content=$_.content; timestamp=$_.timestamp } } | ConvertTo-Json -Depth 3
        }
    }
} catch {
    $errBody = $_.ErrorDetails.Message
    if ($errBody) { Write-Error "Discord API error: $errBody" } else { Write-Error "Discord API error: $($_.Exception.Message)" }
    exit 1
}
