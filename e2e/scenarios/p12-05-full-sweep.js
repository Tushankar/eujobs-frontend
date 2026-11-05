import { sweepRoutes } from '../lib/sweep.js'

/**
 * P12-05: every route of every role in en, es and fr (lib/sweep.js): no console errors, failed requests, missing keys,
 * English leftovers or layout problems at 1440 and 375 px.
 */
export default {
  name: 'P12-05 Full sweep en es fr',
  viewports: ['D', 'M'],
  async run(ctx) {
    const failures = []
    for (const language of ['en', 'es', 'fr']) {
      const result = await sweepRoutes(ctx, language)
      ctx.note(`${language}: ${result.counts.join(', ')}`)
      if (result.notes.length) ctx.note(`${language} truncated data (ellipsis), ${result.notes.length}`)
      failures.push(...result.failures.map((failure) => `${language} ${failure}`))
    }
    ctx.check(!failures.length, `${failures.length} route(s) failed:\n  ${failures.join('\n  ')}`)
  },
}
