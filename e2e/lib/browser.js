import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { CHROME, WEB_URL } from './env.js'

/*
 * Page checks shared by every scenario (§2.13): console errors, page errors, unexpected 4xx/5xx
 * responses and, at 375 px, horizontal overflow. A scenario allows an expected status with allow().
 * Only this app is checked: Stripe's hosted Checkout and Portal pages (and their requests) are not ours.
 */
export const VIEWPORTS = {
  D: { width: 1440, height: 900 },
  M: { width: 375, height: 812 },
}

export function launchChrome() {
  return puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--no-default-browser-check'] })
}

export async function openPage(context, viewport) {
  const page = await context.newPage()
  await page.setViewport(VIEWPORTS[viewport])
  const issues = []
  const allowed = []
  const isAllowed = (status, url = '') => allowed.some((rule) => rule.status === status && url.includes(rule.urlPart))

  const ours = () => page.url().startsWith(WEB_URL)
  page.on('pageerror', (error) => ours() && issues.push(`page error: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error' || !ours()) return
    // Chrome also logs every failed response; allowed statuses are not errors.
    const status = Number(message.text().match(/status of (\d{3})/)?.[1])
    if (status && isAllowed(status, message.location()?.url)) return
    issues.push(`console error: ${message.text()}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().startsWith(WEB_URL) && !isAllowed(response.status(), response.url())) {
      issues.push(`HTTP ${response.status()} ${response.url()}`)
    }
  })

  return {
    page,
    issues,
    allow: (status, urlPart) => allowed.push({ status, urlPart }),
    /** Horizontal overflow at the mobile width (§2.13). */
    async checkOverflow() {
      if (viewport !== 'M') return
      const { overflow, culprits } = await page.evaluate(() => {
        const width = document.documentElement.clientWidth
        // Name the cause (at most three): the innermost elements past the right edge, else the elements whose own text
        // runs past it (text spilling out of its box).
        const wide = [...document.querySelectorAll('body *')].filter((element) => element.getBoundingClientRect().right > width + 0.5)
        const innermost = wide.filter((element) => !wide.some((other) => other !== element && element.contains(other)))
        const range = document.createRange()
        const spilling = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node && spilling.length < 3; node = walker.nextNode()) {
          range.selectNodeContents(node)
          const right = range.getBoundingClientRect().right
          if (right > width + 0.5 && !spilling.some((item) => item.element === node.parentElement)) spilling.push({ element: node.parentElement, right })
        }
        const describe = (element, right = element.getBoundingClientRect().right) => {
          const name = `${element.tagName.toLowerCase()}${typeof element.className === 'string' && element.className ? `.${element.className.trim().split(/\s+/).join('.')}` : ''}`
          return `${name} "${(element.textContent ?? '').trim().slice(0, 40)}" (right edge ${Math.round(right)}px)`
        }
        const culprits = innermost.length ? innermost.slice(0, 3).map((element) => describe(element)) : spilling.map((item) => describe(item.element, item.right))
        return { overflow: document.documentElement.scrollWidth - width, culprits }
      })
      if (overflow > 0) issues.push(`horizontal overflow of ${overflow}px at 375 px: ${culprits.join(', ')}`)
    },
  }
}

export async function screenshot(page, dir, name) {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${name.replace(/[^a-z0-9-]+/gi, '_')}.jpg`)
  await page.screenshot({ path, type: 'jpeg', quality: 55 })
  return path
}
