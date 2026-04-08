$lines = Get-Content "C:\Users\vboxuser\.openclaw\workspaces\workspace-max\skills\discord\scripts\discord.ps1"
for ($i = 44; $i -le 75; $i++) {
    Write-Output "Line $i : $($lines[$i-1])"
}