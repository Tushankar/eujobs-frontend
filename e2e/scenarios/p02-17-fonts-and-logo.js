import { signInWithForm } from '../lib/flows.js'

/** P2-17 (M-192, OD11): no Google Fonts request; the logo is the inline EU JOBS SVG (Figma 484:7863) labelled with the brand. */
export default {
  name: 'P2-17 Fonts and logo',
  viewports: ['D'],
  async run(ctx) {
    const handle = await ctx.newPage()
    const { page } = handle
    const requested = []
    page.on('request', (request) => requested.push(request.url()))

    await signInWithForm(page, ctx.webUrl, '/sign-in', ctx.seedCredentials.email('emma'), ctx.seedCredentials.password)
    const google = requested.filter((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))
    ctx.check(!google.length, `Google Fonts requests: ${google.join(', ')}`)

    const fonts = await page.evaluate(async () => {
      await document.fonts.ready
      return { manrope: document.fonts.check('800 16px Manrope'), inter: document.fonts.check('400 16px Inter') }
    })
    ctx.check(fonts.manrope && fonts.inter, `self-hosted fonts loaded: ${JSON.stringify(fonts)}`)

    const logo = await page.$eval('aside a[aria-label] [role="img"]', (el) => ({ label: el.getAttribute('aria-label'), shapes: el.querySelectorAll('svg path').length, width: el.getBoundingClientRect().width }))
    ctx.check(logo.shapes === 29 && logo.width > 0, `logo svg: ${logo.shapes} shapes, ${logo.width}px wide`)
    ctx.check(logo.label === 'EU Jobs · AI Powered Careers', `logo label "${logo.label}"`)
    await ctx.screenshot(page, 'logo-and-fonts')
    ctx.assertClean(handle.issues, 'fonts and logo')
  },
}
