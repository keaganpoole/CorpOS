$json = Get-Content -Raw 'C:\Users\vboxuser\.openclaw\workspaces\workspace-yanna\lead1_final.json' | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 5
Write-Host $json