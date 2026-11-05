import { signInWithForm } from './flows.js'
import { TEST_PASSWORD } from './testApi.js'

/*
 * Phase 11c (§3.22) helpers: a recruiter's locks open the Recruiter Plus upgrade dialog without sending the request.
 */

/** Records every API request the page sends; `since()` returns those after the last `mark()`. */
export function trackRequests(page) {
  const requests = []
  let from = 0
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/api/v1/')) requests.push(`${request.method()} ${url.slice(url.indexOf('/api/v1/') + 7)}`)
  })
  return {
    mark: () => (from = requests.length),
    since: () => requests.slice(from),
  }
}

export async function signInRecruiter(ctx, page, email, path, password = TEST_PASSWORD) {
  await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', email, password)
  await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
}

/**
 * Clicks a locked control (`click()`), expects the upgrade dialog naming Recruiter Plus (`planName`) and no request
 * matching `forbidden`, then closes the dialog with Escape. Returns the dialog text.
 */
export async function expectLock(ctx, page, requests, { label, click, forbidden, planName = 'Recruiter Plus' }) {
  requests.mark()
  await click()
  await page.waitForSelector('[role="dialog"] [data-checkout-summary]', { visible: true, timeout: 15_000 })
  const text = await page.$eval('[role="dialog"]', (dialog) => dialog.innerText)
  ctx.check(text.includes(planName), `${label}: the upgrade dialog names ${planName} (${text.slice(0, 120).replace(/\n/g, ' ')})`)
  const sent = requests.since().filter((request) => forbidden.test(request))
  ctx.check(sent.length === 0, `${label}: no locked request was sent (${sent.join(', ')})`)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[role="dialog"] [data-checkout-summary]'), { timeout: 10_000 })
  return text
}

/** Clicks the first visible element under `scope` whose text includes `text` (buttons inside cards, menus, …). */
export async function clickWithin(page, scope, text) {
  const done = await page.evaluate(
    (selector, label) => {
      const target = [...document.querySelectorAll(selector)].find((element) => element.offsetParent !== null && element.innerText.includes(label))
      target?.click()
      return Boolean(target)
    },
    scope,
    text,
  )
  if (!done) throw new Error(`nothing in ${scope} reads "${text}"`)
}
