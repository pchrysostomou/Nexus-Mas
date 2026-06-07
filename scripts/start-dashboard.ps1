$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Test-Path ".next\BUILD_ID")) {
  npm.cmd run build
}

npm.cmd run serve:dashboard
