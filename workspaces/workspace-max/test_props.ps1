$webClient = New-Object System.Net.WebClient
$props = $webClient | Get-Member -MemberType Property
$props | Format-Table -AutoSize