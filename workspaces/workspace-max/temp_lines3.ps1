$lines = Get-Content "C:\Users\vboxuser\.openclaw\workspaces\workspace-max\skills\discord\scripts\discord.ps1"
for ($i = 50; $i -lt 85; $i++) {
    Write-Output "$i $($lines[$i-1])"
}