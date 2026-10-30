import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { API_PORT, API_URL, CLIENT_DIR, SERVER_DIR, serverChildEnv, viteChildEnv, WEB_PORT, WEB_URL } from './env.js'

/* Seeds eujobs_test, then starts the API (5100, test mode) and Vite (5174) for one run (§2.13). */
const children = []

export function seedTestDatabase() {
  for (const script of ['seed/catalog.js', 'seed/demo.js']) {
    const result = spawnSync(process.execPath, ['--env-file=.env', script], { cwd: SERVER_DIR, env: serverChildEnv, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`${script} failed (exit ${result.status})`)
  }
}

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer()
      .once('error', () => reject(new Error(`Port ${port} is in use; stop the process holding it and run again`)))
      .once('listening', () => probe.close(resolve))
      .listen(port)
  })
}

async function waitFor(url, label, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`${label} did not start within ${timeoutMs / 1000} s`)
}

function start(args, { cwd, env, logFile }) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  const log = createWriteStream(logFile)
  child.stdout.pipe(log)
  child.stderr.pipe(log)
  children.push(child)
  return child
}

export async function startStack(runDir) {
  await assertPortFree(API_PORT)
  await assertPortFree(WEB_PORT)
  start(['--env-file=.env', 'server.js'], { cwd: SERVER_DIR, env: serverChildEnv, logFile: join(runDir, 'server.log') })
  start([join(CLIENT_DIR, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(WEB_PORT), '--strictPort'], {
    cwd: CLIENT_DIR,
    env: viteChildEnv,
    logFile: join(runDir, 'vite.log'),
  })
  await waitFor(`${API_URL}/api/v1/health`, 'The API')
  await waitFor(WEB_URL, 'Vite')
}

export function stopStack() {
  for (const child of children) child.kill()
}
