$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

$outputDirectory = Join-Path $projectRoot "out"
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $outputDirectory "promo_raw-render-$timestamp.log"
$outputPath = Join-Path $outputDirectory "promo_raw.mp4"

@(
  "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
  "Composition: Nodemere-Film"
  "Output: $outputPath"
  "Settings: H.264, 2560x1440, 60 fps, CRF 16"
  "Command: npx remotion render Nodemere-Film out/promo_raw.mp4 --scale=0.6666666666666666 --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709 --concurrency=3 --timeout=120000"
  ""
) | Set-Content -LiteralPath $logPath -Encoding UTF8

& npx remotion render Nodemere-Film $outputPath `
  --scale=0.6666666666666666 `
  --codec=h264 `
  --crf=16 `
  --pixel-format=yuv420p `
  --color-space=bt709 `
  --concurrency=3 `
  --timeout=120000 2>&1 | Tee-Object -FilePath $logPath -Append

$renderExitCode = $LASTEXITCODE
"`nFinished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')" | Add-Content -LiteralPath $logPath -Encoding UTF8
"Exit code: $renderExitCode" | Add-Content -LiteralPath $logPath -Encoding UTF8

Write-Host "Render log: $logPath"
if ($renderExitCode -ne 0) {
  Write-Error "Render failed with exit code $renderExitCode. Full output is saved in the render log."
  exit $renderExitCode
}
