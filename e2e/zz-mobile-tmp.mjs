import puppeteer from 'puppeteer-core'
const [chrome, out] = process.argv.slice(2)
const b = await puppeteer.launch({ executablePath: chrome, headless: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
for (const [w, scheme] of [[390, 'light'], [390, 'dark'], [1366, 'light']]) {
  const p = await b.newPage()
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
  await p.setViewport({ width: w, height: 900 })
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
  const el = await p.waitForSelector('[data-landing-sectors]')
  await el.scrollIntoView(); await wait(3000)
  const visible = () => p.$$eval('[data-sector-link]', (els) => els.filter((e) => e.offsetParent && getComputedStyle(e.parentElement).opacity === '1').length)
  const btn = await p.$eval('[data-landing-sectors] button', (b) => getComputedStyle(b).display !== 'none' ? b.innerText : 'hidden')
  console.log(w, scheme, 'visible rows:', await visible(), '| button:', btn)
  await p.evaluate(() => scrollBy(0, -80)); await wait(300)
  await el.screenshot({ path: `${out}/m-${w}-${scheme}-closed.png` })
  if (w < 700) {
    await p.click('[data-landing-sectors] button'); await wait(800)
    console.log('  after click rows:', await visible(), '| button:', await p.$eval('[data-landing-sectors] button', (b) => b.innerText + ' expanded=' + b.getAttribute('aria-expanded')))
    if (scheme === 'light') await el.screenshot({ path: `${out}/m-${w}-${scheme}-open.png` })
    await p.click('[data-landing-sectors] button'); await wait(300)
    console.log('  collapsed again rows:', await visible())
  }
  await p.close()
}
await b.close()
