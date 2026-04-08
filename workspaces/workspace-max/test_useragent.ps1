$webClient = New-Object System.Net.WebClient
try {
    $webClient.Headers.Add("User-Agent", "Test")
    Write-Output "Success"
} catch {
    Write-Error $_.Exception.Message
}