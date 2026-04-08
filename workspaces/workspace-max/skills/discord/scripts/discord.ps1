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

# Use .NET WebClient for better compatibility
$Headers = @{
    "Authorization" = "Bot $Token"
    "Content-Type" = "application/json"
}

$Base = "https://discord.com/api/v10"

try {
    switch ($Action) {
        'send' {
            if (-not $ChannelId -or -not $Content) { Write-Error "-ChannelId and -Content required"; exit 1 }
            $body = @{ content = $Content } | ConvertTo-Json
            $uri = "$Base/channels/$ChannelId/messages"
            
            # Use WebClient for better compatibility
            $webClient = New-Object System.Net.WebClient
            $webClient.Headers.Add("Authorization", "Bot $Token")
            $webClient.Headers.Add("Content-Type", "application/json")
            try {
                $response = $webClient.UploadString($uri, "POST", $body)
                $r = $response | ConvertFrom-Json
                Write-Output "Sent (msg: $($r.id))"
            } catch {
                throw $_
            } finally {
                $webClient.Dispose()
            }
        }
        'reply' {
            if (-not $ChannelId -or -not $MessageId -or -not $Content) { Write-Error "-ChannelId, -MessageId, and -Content required"; exit 1 }
            $body = @{ content = $Content; message_reference = @{ message_id = $MessageId; channel_id = $ChannelId } } | ConvertTo-Json
            $uri = "$Base/channels/$ChannelId/messages"
            
            $webClient = New-Object System.Net.WebClient
            $webClient.Headers.Add("Authorization", "Bot $Token")
            $webClient.Headers.Add("Content-Type", "application/json")
            try {
                $response = $webClient.UploadString($uri, "POST", $body)
                $r = $response | ConvertFrom-Json
                Write-Output "Replied to $MessageId (msg: $($r.id))"
            } catch {
                throw $_
            } finally {
                $webClient.Dispose()
            }
        }
        'react' {
            if (-not $ChannelId -or -not $MessageId -or -not $Emoji) { Write-Error "-ChannelId, -MessageId, and -Emoji required"; exit 1 }
            $encodedEmoji = [uri]::EscapeDataString($Emoji)
            $uri = "$Base/channels/$ChannelId/messages/$MessageId/reactions/$encodedEmoji/@me"
            
            $webClient = New-Object System.Net.WebClient
            $webClient.Headers.Add("Authorization", "Bot $Token")
            $webClient.Headers.Add("Content-Type", "application/json")
            try {
                $webClient.UploadString($uri, "PUT", "")
                Write-Output "Reacted $Emoji to $MessageId"
            } catch {
                throw $_
            } finally {
                $webClient.Dispose()
            }
        }
        'delete' {
            if (-not $ChannelId -or -not $MessageId) { Write-Error "-ChannelId and -MessageId required"; exit 1 }
            $uri = "$Base/channels/$ChannelId/messages/$MessageId"
            
            $webRequest = [System.Net.WebRequest]::Create($uri)
            $webRequest.Method = "DELETE"
            $webRequest.Headers.Add("Authorization", "Bot $Token")
            $webRequest.UserAgent = "DiscordBot (https://github.com/openclaw/openclaw, 1.0)"
            $webRequest.GetResponse() | Out-Null
            Write-Output "Deleted message $MessageId"
        }
        'history' {
            if (-not $ChannelId) { Write-Error "-ChannelId required"; exit 1 }
            $uri = "$Base/channels/$ChannelId/messages?limit=$Limit"
            
            $webRequest = [System.Net.WebRequest]::Create($uri)
            $webRequest.Method = "GET"
            $webRequest.Headers.Add("Authorization", "Bot $Token")
            $webRequest.UserAgent = "DiscordBot (https://github.com/openclaw/openclaw, 1.0)"
            $response = $webRequest.GetResponse()
            $stream = $response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $result = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            $messages = $result | ConvertFrom-Json
            $messages | ForEach-Object { @{ id=$_.id; author=$_.author.username; content=$_.content; timestamp=$_.timestamp } } | ConvertTo-Json -Depth 3
        }
    }
} catch {
    $errBody = $_.ErrorDetails.Message
    if ($errBody) { Write-Error "Discord API error: $errBody" } else { Write-Error "Discord API error: $($_.Exception.Message)" }
    exit 1
}