// Temporary screenshot helper (pricing work, 2026-11-13): node e2e/shot.mjs <url> <out.png> [width] [height] [token]
import { launchChrome } from './lib/browser.js'

const [url, out, width = '1440', height = '900', token] = process.argv.slice(2)
const browser = await launchChrome()
const page = await browser.newPage()
await page.setViewport({ width: Number(width), height: Number(height) })
if (token) {
  await page.evaluateOnNewDocument((value) => localStorage.setItem('lwm-auth-token', value), token)
}
page.on('pageerror', (error) => console.log('pageerror', error.message))
page.on('console', (message) => message.type() === 'error' && console.log('console', message.text()))
await page.goto(url, { waitUntil: 'networkidle0' })
for (const selector of (process.env.CLICK ?? '').split('|').filter(Boolean)) {
  await page.click(selector)
  await new Promise((resolve) => setTimeout(resolve, 400))
}
await new Promise((resolve) => setTimeout(resolve, 800))
await page.screenshot({ path: out, fullPage: true })
await browser.close()
