import { launchChrome } from './lib/browser.js'
const out = 'C:/Users/tusha/AppData/Local/Temp/claude/600f371016501a56/6fea9ad0-75a4-40bb-91a5-56737a97eecf/scratchpad'
const browser = await launchChrome()
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
const section = await page.$('[aria-labelledby="categories-title"]')
await section.scrollIntoView()
await new Promise((r) => setTimeout(r, 3500))
const info = await page.$$eval('[aria-labelledby="categories-title"] a', (cards) => cards.slice(0, 3).map((a) => {
  const span = a.querySelector('[data-svg="icon"]'); const svg = span.querySelector('svg'); const r = svg.getBoundingClientRect(); const s = span.getBoundingClientRect()
  const p = svg.querySelector('path')
  return { name: a.querySelector('h3').textContent, slot: [s.width, s.height], svg: [+r.width.toFixed(2), +r.height.toFixed(2), +(r.top - s.top).toFixed(2), +(r.left - s.left).toFixed(2)], fill: getComputedStyle(p).fill, color: getComputedStyle(span).color, paths: svg.querySelectorAll('path').length }
}))
console.log(JSON.stringify(info, null, 1))
await section.screenshot({ path: out + '/categories.png' })
await page.hover('[aria-labelledby="categories-title"] a:nth-of-type(2)')
await new Promise((r) => setTimeout(r, 600))
const grid = await page.$('[aria-labelledby="categories-title"] a:nth-of-type(2)')
await grid.screenshot({ path: out + '/hybrid-hover.png' })
console.log('errors', errors)
await browser.close()
