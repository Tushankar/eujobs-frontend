import { sweepRoutes } from '../lib/sweep.js'

/* The route sweep in English (lib/sweep.js): every route of every role, with the page and layout checks. */
export default {
  name: 'Route sweep',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { failures, notes, counts } = await sweepRoutes(ctx, 'en')
    ctx.note(`routes: ${counts.join(', ')}`)
    if (notes.length) ctx.note(`truncated data (ellipsis), ${notes.length}:\n      ${notes.join('\n      ')}`)
    ctx.check(!failures.length, `${failures.length} route(s) failed:\n  ${failures.join('\n  ')}`)
  },
}
