import { sweepRoutes } from '../lib/sweep.js'

/**
 * P11-01: the route sweep in Spanish and in French for every role (public, candidate, recruiter in onboarding,
 * recruiter, admin): zero missing keys (a console error), zero layout problems at 1440 and 375 px, and no English
 * leftover (rendered text equal to an en value of more than 3 words that the language translates differently, P11-Q3).
 */
export default {
  name: 'P11-01 Sweep es and fr',
  viewports: ['D', 'M'],
  async run(ctx) {
    const failures = []
    for (const language of ['es', 'fr']) {
      const result = await sweepRoutes(ctx, language)
      ctx.note(`${language}: ${result.counts.join(', ')}`)
      if (result.notes.length) ctx.note(`${language} truncated data (ellipsis), ${result.notes.length}:\n      ${result.notes.join('\n      ')}`)
      failures.push(...result.failures.map((failure) => `${language} ${failure}`))
    }
    ctx.check(!failures.length, `${failures.length} route(s) failed:\n  ${failures.join('\n  ')}`)
  },
}
