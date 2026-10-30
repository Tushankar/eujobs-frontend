import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { CHROME } from './env.js'

/*
 * Page checks shared by every scenario (§2.13): console errors, page errors, unexpected 4xx/5xx
 * responses and, at 375 px, horizontal overflow. A scenario allows an expected status with allow().
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

  page.on('pageerror', (error) => issues.push(`page error: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    // Chrome also logs every failed response; allowed statuses are not errors.
    const status = Number(message.text().match(/status of (\d{3})/)?.[1])
    if (status && isAllowed(status, message.location()?.url)) return
    issues.push(`console error: ${message.text()}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400 && !isAllowed(response.status(), response.url())) {
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
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (overflow > 0) issues.push(`horizontal overflow of ${overflow}px at 375 px`)
    },
  }
}

export async function screenshot(page, dir, name) {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${name.replace(/[^a-z0-9-]+/gi, '_')}.jpg`)
  await page.screenshot({ path, type: 'jpeg', quality: 55 })
  return path
}
