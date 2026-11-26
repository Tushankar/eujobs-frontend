import puppeteer from 'puppeteer-core'
const [chrome, out] = process.argv.slice(2)
const b = await puppeteer.launch({ executablePath: chrome, headless: true })
for (const [w, scheme] of [[1366, 'dark'], [1366, 'light'], [900, 'light'], [390, 'light'], [390, 'dark']]) {
  const p = await b.newPage()
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
  await p.setViewport({ width: w, height: 900 })
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
  const el = await p.waitForSelector('[data-landing-sectors]')
  await el.scrollIntoView(); await new Promise(r => setTimeout(r, 3000))
  if (w === 1366 && scheme === 'light') { await p.hover('[data-sector-link]'); await new Promise(r => setTimeout(r, 300)) }
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  console.log(w, scheme, 'h-overflow:', overflow)
  await el.screenshot({ path: `${out}/sectors-${w}-${scheme}.png` })
  await p.close()
}
await b.close()
