# MDM NSI - local web server for an offline Windows PC (no Node.js, no admin rights, no installs).
# Serves ./app on http://localhost:<Port>/ with SPA fallback (unknown routes -> index.html).
# Usage:  serve.ps1 [-Port 8080] [-Root .\app] [-NoBrowser]
# Messages are ASCII on purpose: Windows PowerShell 5.1 misreads UTF-8 scripts without BOM.

param(
  [int]$Port = 8080,
  [string]$Root = (Join-Path $PSScriptRoot 'app'),
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$mime = @{
  '.html'  = 'text/html; charset=utf-8'
  '.js'    = 'text/javascript; charset=utf-8'
  '.mjs'   = 'text/javascript; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.json'  = 'application/json; charset=utf-8'
  '.map'   = 'application/json; charset=utf-8'
  '.svg'   = 'image/svg+xml'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.ico'   = 'image/x-icon'
  '.woff'  = 'font/woff'
  '.woff2' = 'font/woff2'
  '.ttf'   = 'font/ttf'
  '.eot'   = 'application/vnd.ms-fontobject'
  '.txt'   = 'text/plain; charset=utf-8'
}

$rootFull = [IO.Path]::GetFullPath($Root)
if (-not (Test-Path (Join-Path $rootFull 'index.html'))) {
  Write-Host "index.html not found in $rootFull" -ForegroundColor Red
  exit 1
}

# localhost only: no URL ACL / admin rights needed; service workers (demo data) require localhost or HTTPS
$prefix = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Port $Port is busy. Try another one:  serve.ps1 -Port 8081" -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host "  MDM NSI is running:  $prefix" -ForegroundColor Cyan
Write-Host '  Keep this window open. Close it (or press Ctrl+C) to stop the server.'
Write-Host ''
if (-not $NoBrowser) { Start-Process $prefix }

function Send-File($ctx, [string]$file) {
  $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
  $type = $mime[$ext]
  if (-not $type) { $type = 'application/octet-stream' }
  $res = $ctx.Response
  $res.ContentType = $type
  # Hashed assets are immutable; index.html and the service worker must always be fresh
  if ($file -match '[\\/]assets[\\/]') { $res.Headers['Cache-Control'] = 'public, max-age=31536000, immutable' }
  else { $res.Headers['Cache-Control'] = 'no-cache' }
  $bytes = [IO.File]::ReadAllBytes($file)
  $res.ContentLength64 = $bytes.Length
  if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
}

try {
  while ($listener.IsListening) {
    # Async wait in short slices so Ctrl+C can stop the loop
    $task = $listener.GetContextAsync()
    while (-not $task.AsyncWaitHandle.WaitOne(500)) {}
    $ctx = $task.GetAwaiter().GetResult()
    try {
      $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      $file = [IO.Path]::GetFullPath((Join-Path $rootFull $rel))
      $inside = $file.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)
      if ($inside -and (Test-Path -LiteralPath $file -PathType Leaf)) {
        Send-File $ctx $file
      } elseif ([IO.Path]::GetExtension($rel)) {
        # Missing file with an extension (asset) -> 404
        $ctx.Response.StatusCode = 404
      } else {
        # Application route (/catalogs/..., /requests?id=...) -> SPA entry point
        Send-File $ctx (Join-Path $rootFull 'index.html')
      }
    } catch {
      $ctx.Response.StatusCode = 500
    } finally {
      $ctx.Response.Close()
    }
  }
} finally {
  $listener.Stop()
}
