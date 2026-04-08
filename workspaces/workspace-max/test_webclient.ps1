$webClient = New-Object System.Net.WebClient
$webClient | Get-Member -MemberType Property | Where-Object { $_.Name -like "*User*" }