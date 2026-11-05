import { spawn } from 'node:child_process'
import { acquireTestLock } from './lock.js'

/*
 * npm test [-- flags or files]: takes the eujobs_test lock (test/lock.js), then runs the API tests one file at a time.
 * With no files it runs every test file.
 */
const args = process.argv.slice(2)
const flags = args.filter((arg) => arg.startsWith('-'))
const files = args.filter((arg) => !arg.startsWith('-'))
acquireTestLock(['npm test', ...args].join(' '))

const child = spawn(process.execPath, ['--env-file=.env', '--import', './test/setup.js', '--test', '--test-concurrency=1', ...flags, ...(files.length ? files : ['test/**/*.test.js'])], {
  stdio: 'inherit',
  env: { ...process.env, EUJOBS_TEST_LOCK: String(process.pid) },
})
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
