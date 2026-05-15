/**
 * Free the dev port if something is listening, then start `next dev` on that port.
 */
import { execFileSync, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT ?? 3000)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function killListenersWindows(port: number) {
  // Dedupe PIDs (IPv4 + IPv6 rows); try/catch + exit 0 so cleanup never aborts `bun run dev`.
  const script =
    `$ErrorActionPreference = 'SilentlyContinue'; ` +
    `try { ` +
    `$c = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue; ` +
    `if ($null -ne $c) { ` +
    `$c | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } ` +
    `} ` +
    `} catch { }; ` +
    `exit 0`
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: 'ignore',
    })
  } catch {
    // best-effort only
  }
}

function killListenersUnix(port: number) {
  try {
    const out = execFileSync(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf8' },
    )
    const pids = [...new Set(out.trim().split(/\s+/).filter(Boolean))]
    for (const id of pids) {
      try {
        process.kill(Number(id), 'SIGKILL')
      } catch {
        // already gone or EPERM
      }
    }
  } catch {
    // lsof exits 1 when nothing matches
  }
}

function killListeners(port: number) {
  if (process.platform === 'win32') killListenersWindows(port)
  else killListenersUnix(port)
}

killListeners(PORT)
await new Promise<void>((resolve) => setTimeout(resolve, 400))

const child = spawn('bun', ['x', 'next', 'dev', '-p', String(PORT)], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 0)
})
