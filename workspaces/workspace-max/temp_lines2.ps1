$lines = Get-Content "C:\Users\vboxuser\.openclaw\workspaces\workspace-max\skills\discord\scripts\discord.ps1"
for ($i = 79; $i -lt 130; $i++) {
    Write-Output "$i $($lines[$i-1])"
}