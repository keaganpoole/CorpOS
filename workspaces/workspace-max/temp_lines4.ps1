$lines = Get-Content "C:\Users\vboxuser\.openclaw\workspaces\workspace-max\skills\discord\scripts\discord.ps1"
for ($i = 26; $i -lt 55; $i++) {
    Write-Output "$i $($lines[$i-1])"
}