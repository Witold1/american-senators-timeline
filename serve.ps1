# Start a local web server for the timeline.
# Usage: right-click → Run with PowerShell, or: .\serve.ps1

$root = $PSScriptRoot
$port = 8080

function Test-PortFree([int]$p) {
  -not (Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue)
}

while (-not (Test-PortFree $port)) { $port++ }

Write-Host ""
Write-Host "  American Senators Timeline" -ForegroundColor Cyan

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' -and $_.IPAddress -notlike '169.*' } |
  Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host "  On this PC:    http://localhost:$port" -ForegroundColor Green
if ($lanIp) {
  Write-Host "  On your phone: http://${lanIp}:$port" -ForegroundColor Yellow
} else {
  Write-Host "  On your phone: (no LAN IP found - check Wi-Fi)" -ForegroundColor DarkYellow
}
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://+:$port/")
try {
  $listener.Start()
} catch [System.Net.HttpListenerException] {
  Write-Host "  Could not bind to the network. Run once as Administrator:" -ForegroundColor Red
  Write-Host "    netsh http add urlacl url=http://+:$port/ user=Everyone" -ForegroundColor DarkGray
  throw
}

$mimes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".ico"  = "image/x-icon"
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $rel = [Uri]::UnescapeDataString($req.Url.LocalPath).TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }

    $file = Join-Path $root ($rel -replace "/", [IO.Path]::DirectorySeparatorChar)
    $safe = [IO.Path]::GetFullPath($file)
    if (-not $safe.StartsWith([IO.Path]::GetFullPath($root))) {
      $res.StatusCode = 403
      $bytes = [Text.Encoding]::UTF8.GetBytes("Forbidden")
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.Close()
      continue
    }

    if (Test-Path $safe -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($safe).ToLower()
      $res.ContentType = $mimes[$ext]
      if (-not $res.ContentType) { $res.ContentType = "application/octet-stream" }
      $bytes = [IO.File]::ReadAllBytes($safe)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes("Not found")
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }

    $res.Close()
  }
} finally {
  $listener.Stop()
}
