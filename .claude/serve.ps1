# Minimal static file server for local preview (localhost only, no dependencies).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .claude/serve.ps1 [-Port 8765]
param([int]$Port = 8765, [string]$Root = '')
if (-not $Root) { $Root = Join-Path $PSScriptRoot '..\venturi-jet-pump-app' }
$Root = (Resolve-Path $Root).Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://localhost:$Port/"
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.json' = 'application/json; charset=utf-8'; '.webp' = 'image/webp'
  '.ico' = 'image/x-icon'; '.md' = 'text/plain; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
}
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $Root $rel))
    if (-not $file.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) { $ctx.Response.StatusCode = 403 }
    elseif (Test-Path $file -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $type = $mime[$ext]; if (-not $type) { $type = 'application/octet-stream' }
      $ctx.Response.ContentType = $type
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
  } catch { $ctx.Response.StatusCode = 500 }
  finally { $ctx.Response.OutputStream.Close() }
}
