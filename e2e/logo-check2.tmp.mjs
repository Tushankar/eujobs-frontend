import { readFileSync } from 'node:fs'
import { launchChrome } from './lib/browser.js'
import { signInWithForm } from './lib/flows.js'
import { seedCredentials } from './lib/env.js'
const out = 'C:/Users/tusha/AppData/Local/Temp/claude/600f371016501a56/6fea9ad0-75a4-40bb-91a5-56737a97eecf/scratchpad/v'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await launchChrome()
const errors = []
const page = async () => { const p = await b.newPage(); p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => m.type() === 'error' && errors.push(m.text())); await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 }); return p }
// Sticky nav: wheel-scroll past the header, then hover its logo mid-shine.
const l = await page(); await l.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
await l.mouse.move(700, 500); for (let i = 0; i < 12; i++) { await l.mouse.wheel({ deltaY: 300 }); await wait(120) }
await wait(1200)
const sticky = await l.$$eval('[role="img"][aria-label^="EU Jobs"]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), e.className] }))
console.log('logos', sticky)
await l.screenshot({ path: out + '/sticky.png', clip: { x: 0, y: 0, width: 1440, height: 110 } })
const s = sticky.find(([x, y]) => y >= 0 && y < 100)
if (s) { await l.mouse.move(s[0] + s[2] / 2, s[1] + s[3] / 2); await wait(450); await l.screenshot({ path: out + '/sticky-hover.png', clip: { x: s[0] - 8, y: s[1] - 8, width: s[2] + 16, height: s[3] + 16 } }) }
// Admin sign-in: the white EU mark on the photo.
const a = await page(); await a.goto('http://localhost:5173/admin/sign-in', { waitUntil: 'networkidle0' }); await wait(2500)
const mark = await a.$('img[class*="heroBrandMark"]'); await (await mark.evaluateHandle((m) => m.parentElement)).screenshot({ path: out + '/admin-mark.png' })
// Candidate sidebar + upsell mark + hover shine.
const c = await page()
await signInWithForm(c, 'http://localhost:5173', '/sign-in', seedCredentials.email('emma'), seedCredentials.password)
await wait(2000)
const side = await c.$('aside a[aria-label] [role="img"]'); await side.screenshot({ path: out + '/sidebar-logo.png' })
const up = await c.$('[data-promo="upsell"]'); if (up) await up.screenshot({ path: out + '/upsell.png' }); else console.log('no upsell card for emma')
const box = await side.boundingBox(); await c.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await wait(400); await side.screenshot({ path: out + '/sidebar-hover.png' })
// Email header PNG on the navy band.
const e = await page(); await e.setViewport({ width: 400, height: 120, deviceScaleFactor: 1 })
await e.setContent('<body style="margin:0;background:#012B74;padding:20px"><img width="150" src="data:image/png;base64,' + readFileSync('../client/public/email/logo-white.png').toString('base64') + '"></body>')
await e.screenshot({ path: out + '/email.png' })
console.log('errors', errors)
await b.close()
