$Url = $env:SUPABASE_URL
$Key = $env:SUPABASE_ANON_KEY
$Headers = @{ "apikey"=$Key; "Authorization"="Bearer $Key"; "Content-Type"="application/json" }
$json = Get-Content -Path "C:\Users\vboxuser\.openclaw\workspaces\workspace-yanna\new_lead.json" -Raw
Write-Output "Sending: $json"
try {
    $r = Invoke-RestMethod -Uri "$Url/rest/v1/leads" -Headers $Headers -Method POST -Body $json
    Write-Output "Created"
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $reader.BaseStream.Position = 0
    $reader.DiscardBufferedData()
    $body = $reader.ReadToEnd()
    Write-Output "HTTP Error Body: $body"
}