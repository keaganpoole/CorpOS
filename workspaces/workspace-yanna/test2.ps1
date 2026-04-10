Write-Host "Number of args: $($args.Count)"
for ($i = 0; $i -lt $args.Count; $i++) {
    Write-Host "Arg $i`: $($args[$i])"
}