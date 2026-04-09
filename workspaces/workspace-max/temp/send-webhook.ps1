param([string]$Content)
$webhookUrl = $env:DISCORD_WEBHOOK_YANNA
$body = @{ content = $Content } | ConvertTo-Json -Depth 3
try {
    $webClient = New-Object System.Net.WebClient
    $webClient.Headers.Add("Content-Type", "application/json")
    $webClient.UploadString($webhookUrl, "POST", $body)
    Write-Output "Sent via webhook"
} catch {
    Write-Error "Webhook error: $_"
    exit 1
} finally {
    $webClient.Dispose()
}
