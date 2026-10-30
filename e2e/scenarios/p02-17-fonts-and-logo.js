import { signInWithForm } from '../lib/flows.js'

/** P2-17 (M-192, OD11): no Google Fonts request; the logo is the AI mark plus live "Local WorkMan" and "AI Job Portal". */
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

    const logo = await page.$eval('aside a[aria-label]', (link) => ({
      mark: link.querySelector('img')?.getAttribute('src') ?? '',
      text: link.innerText.replace(/\s+/g, ' ').trim(),
      family: getComputedStyle(link.querySelector('span span')).fontFamily,
    }))
    ctx.check(logo.mark.includes('logo-mark'), `logo image ${logo.mark}`)
    ctx.check(logo.text === 'Local WorkMan AI Job Portal', `logo text "${logo.text}"`)
    ctx.check(logo.family.includes('Manrope'), `logo font ${logo.family}`)
    await ctx.screenshot(page, 'logo-and-fonts')
    ctx.assertClean(handle.issues, 'fonts and logo')
  },
}
