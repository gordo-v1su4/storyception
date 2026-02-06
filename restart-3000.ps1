param(
  [int]$Port = 3000
)

if ($Port -ne 3000) {
  Write-Error "This script only allows port 3000."
  exit 1
}

$connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

if ($pids) {
  Write-Host "Killing processes on port $Port: $($pids -join ', ')"
  foreach ($pid in $pids) {
    try {
      Stop-Process -Id $pid -Force -ErrorAction Stop
    } catch {
      Write-Warning "Failed to kill PID $pid: $($_.Exception.Message)"
    }
  }
} else {
  Write-Host "No process is using port $Port."
}

Write-Host "Starting dev server on port $Port..."
$env:PORT = "$Port"
bun run dev -- --port $Port
