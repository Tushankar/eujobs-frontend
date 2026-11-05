import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/* P12-07 (Phase 12 task 5): `node e2e/audit-static.js` reports 0 findings. */
export default {
  name: 'P12-07 Static audit',
  viewports: ['D'],
  async run(ctx) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../audit-static.js', import.meta.url))], { encoding: 'utf8' })
    const output = result.stdout.trim()
    ctx.note(output.split('\n')[0])
    ctx.check(result.status === 0 && output.endsWith('0 findings'), `the static audit found something:\n${output}`)
  },
}
