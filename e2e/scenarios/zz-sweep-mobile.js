import sweep from './sweep.js'

/* Temporary: the English route sweep on the phone viewport only, with full-page screenshots after scrolling through. */
const SHOTS = 'C:/Users/tusha/AppData/Local/Temp/claude/600f371016501a56/c39f735f-67a8-43f4-8b6d-8b5dd1b5b153/scratchpad/shots3'

async function fullPage(page, name) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    await new Promise((resolve) => setTimeout(resolve, 900))
    window.scrollTo(0, 0)
  })
  await page.screenshot({ path: SHOTS + '/' + name.replace(/[^a-z0-9-]+/gi, '_') + '.jpg', type: 'jpeg', quality: 60, fullPage: true })
}

export default { ...sweep, name: 'Route sweep (phone)', viewports: ['M'], run(ctx) { ctx.screenshot = fullPage; return sweep.run(ctx) } }
