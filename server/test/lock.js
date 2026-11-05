import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'

/*
 * One test run at a time on eujobs_test, which every session on this machine shares: `npm test` (test/run.js) and
 * `node e2e/run.js` take this lock before they start, and a second run exits naming the holder. A lock whose process
 * is gone is cleared.
 */
export const LOCK_FILE = 'C:/eujobs-data/eujobs_test.lock'

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

/** The live lock, or null (a lock left by a dead process counts as none). */
export function activeLock() {
  try {
    const lock = JSON.parse(readFileSync(LOCK_FILE, 'utf8'))
    return alive(lock.pid) ? lock : null
  } catch {
    return null
  }
}

export function lockHolderMessage(lock) {
  return `eujobs_test is in use by "${lock.command}" (session ${lock.session}, pid ${lock.pid}, started ${lock.startedAt}). Wait until it finishes, then run again. Lock file: ${LOCK_FILE}`
}

export function acquireTestLock(command) {
  const lock = { command, session: process.env.CLAUDE_CODE_SESSION_ID ?? 'none (terminal)', pid: process.pid, startedAt: new Date().toISOString() }
  mkdirSync(dirname(LOCK_FILE), { recursive: true })
  for (;;) {
    try {
      const fd = openSync(LOCK_FILE, 'wx')
      writeSync(fd, JSON.stringify(lock, null, 2))
      closeSync(fd)
      break
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const holder = activeLock()
      if (holder) {
        console.error(lockHolderMessage(holder))
        process.exit(3)
      }
      console.error(`Clearing a test lock left by a process that is gone (${LOCK_FILE}).`)
      try {
        unlinkSync(LOCK_FILE)
      } catch {
        // another run cleared it first
      }
    }
  }
  process.on('exit', () => {
    if (activeLock()?.pid === process.pid) unlinkSync(LOCK_FILE)
  })
}
