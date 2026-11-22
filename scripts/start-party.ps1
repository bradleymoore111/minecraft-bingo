# Starts both the local Minecraft Bingo Node.js server and the Cloudflare Tunnel
# Usage: .\scripts\start-party.ps1

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Minecraft Bingo Server'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

# Load .env into current process environment
if (Test-Path "$Root\.env") {
  Get-Content "$Root\.env" | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
      $idx = $line.IndexOf('=')
      $key = $line.Substring(0, $idx).Trim()
      $val = $line.Substring($idx + 1).Trim()
      [Environment]::SetEnvironmentVariable($key, $val, 'Process')
    }
  }
}

$localCf = Join-Path $Root "bin\cloudflared.exe"
$cfPath = if (Test-Path $localCf) {
  $localCf
} else {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { $cmd.Source } else { $null }
}
$token = $env:CLOUDFLARE_TUNNEL_TOKEN

$port = if ($env:PORT) { $env:PORT } else { '3000' }

Write-Host "Starting Minecraft Bingo server on http://localhost:$port..." -ForegroundColor Green
$nodeProc = Start-Process -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory $Root -NoNewWindow -PassThru

$cfProc = $null
if ($cfPath -and $token) {
  Write-Host "Starting Cloudflare Tunnel -> $($env:PUBLIC_URL)..." -ForegroundColor Cyan
  $cfProc = Start-Process -FilePath $cfPath -ArgumentList @("tunnel", "run", "--token", $token) -NoNewWindow -PassThru
} elseif (-not $cfPath) {
  Write-Host "cloudflared not found! Install it once with:" -ForegroundColor Yellow
  Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor White
  Write-Host "Server is still running locally at http://localhost:$port" -ForegroundColor Yellow
} else {
  Write-Host "CLOUDFLARE_TUNNEL_TOKEN is empty in .env. Running locally only." -ForegroundColor Yellow
}

Write-Host "Press Ctrl+C to stop both server and tunnel." -ForegroundColor DarkGray

try {
  Wait-Process -Id $nodeProc.Id
} finally {
  if ($cfProc -and -not $cfProc.HasExited) { Stop-Process -Id $cfProc.Id -Force -ErrorAction SilentlyContinue }
  if ($nodeProc -and -not $nodeProc.HasExited) { Stop-Process -Id $nodeProc.Id -Force -ErrorAction SilentlyContinue }
}
