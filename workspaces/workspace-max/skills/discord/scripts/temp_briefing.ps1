$uri = [System.Environment]::GetEnvironmentVariable("DISCORD_WEBHOOK_YANNA")
$message = @"
**Good evening, team.** ??

Quick update — Kickstarter wrapped up clean: 10 leads from Worcester mechanics, task marked done.

Yanna's standing by and ready to roll. We've got a "Lead Generation" task queued for tomorrow (April 10).

Any new campaigns or targets, just say the word. We're locked and loaded.
"@

$body = @{ content = $message } | ConvertTo-Json
$wc = New-Object System.Net.WebClient
$wc.Headers.Add("Content-Type", "application/json")
$wc.UploadString($uri, "POST", $body)
Write-Output "Posted to Team CorpOS"
