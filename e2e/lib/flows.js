import { mailTo } from './testApi.js'
import { nextAppCode, rememberSecret } from './totp.js'

/* Browser steps shared by scenarios. */

/**
 * Types into a field after clearing it. The clear goes through the native value setter plus an input event, so a React
 * controlled field's state is cleared too (a plain `value = ''` could be undone by the next render, e.g. P10-02).
 */
export async function fill(page, selector, value) {
  await page.waitForSelector(selector)
  await page.$eval(selector, (element) => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value').set.call(element, '')
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.type(selector, value)
}

/** Waits until the path satisfies `test` (a string prefix or a function). */
export function waitForPath(page, test) {
  const predicate = typeof test === 'string' ? `location.pathname.startsWith(${JSON.stringify(test)})` : test
  return page.waitForFunction(predicate, { timeout: 15_000 })
}

/**
 * The next response whose URL contains every part, for `method`. Create it before the action that sends the request.
 * (P10-Q2: steps wait for their own request, never for network idle, which the 15 s counters poll can delay.)
 */
export function responseTo(page, parts, method = 'GET') {
  const wanted = [parts].flat()
  return page.waitForResponse((response) => response.request().method() === method && wanted.every((part) => response.url().includes(part)), { timeout: 15_000 })
}

/** After a navigation: the route's loading fallback is gone and the page heading is on screen. */
export function waitForSettled(page) {
  return page.waitForFunction(() => !document.querySelector('[role="status"][class*="loading"]') && document.querySelector('h1'), { timeout: 15_000 })
}

/**
 * The sign-in second step on screen (2026-11-18): the emailed code from the captured mail, or the authenticator code
 * (an admin's first sign-in sets the app up from the key on screen, then continues past the backup codes).
 */
export async function finishLoginStep(page, email, method) {
  const form = `[data-login-step="${method}"]`
  await page.waitForSelector(form)
  if (method === 'totp_setup') {
    await page.waitForFunction(() => document.querySelector('[data-setup-key]')?.textContent.trim(), { timeout: 15_000 })
    rememberSecret(email, await page.$eval('[data-setup-key]', (key) => key.textContent))
  }
  const code = method === 'email' ? (await mailTo(email, 'login_code')).at(-1)?.params.code : await nextAppCode(email)
  await fill(page, `${form} input[name="code"]`, code)
  const verify = responseTo(page, '/api/v1/auth/login/verify', 'POST')
  await page.click(`${form} button[type="submit"]`)
  await verify
  if (method === 'totp_setup') {
    await page.waitForSelector('[data-backup-continue]')
    await page.click('[data-backup-continue]')
  }
}

/** Submits a filled sign-in form and finishes the second step when one is asked; answers the login response. */
export async function submitSignIn(page, email) {
  const login = responseTo(page, '/api/v1/auth/login', 'POST')
  await page.click('button[type="submit"]')
  const response = await login
  const step = (await response.json().catch(() => null))?.verification
  if (step) await finishLoginStep(page, email, step.method)
  return response
}

/**
 * Signs in through a sign-in form and waits until the URL leaves the sign-in page and the landing page has rendered.
 * A second step (sign-in code, authenticator) is finished on the way.
 */
export async function signInWithForm(page, webUrl, signInPath, email, password) {
  await page.goto(`${webUrl}${signInPath}`, { waitUntil: 'networkidle0' })
  await fill(page, 'input[name="email"]', email)
  await fill(page, 'input[name="password"]', password)
  await submitSignIn(page, email)
  await page.waitForFunction((path) => location.pathname !== path, { timeout: 15_000 }, signInPath)
  // The router keeps the sign-in page on screen until the landing page's data has loaded, so its heading is no sign.
  await page.waitForFunction(() => !document.querySelector('input[name="password"]'), { timeout: 15_000 })
  await waitForSettled(page)
}

/** Visible text of the page body. */
export const bodyText = (page) => page.evaluate(() => document.body.innerText)

/** Clicks the first button or link whose text includes `text`. */
export async function clickText(page, text, selector = 'button, a') {
  const handle = await page.waitForFunction(
    (wanted, query) => [...document.querySelectorAll(query)].find((element) => element.textContent.includes(wanted)),
    { timeout: 10_000 },
    text,
    selector,
  )
  // Centred first, so a sticky header never covers it.
  await handle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await handle.asElement().click()
}

/** Waits until the page text contains `text`. */
export function waitForText(page, text, timeout = 15_000) {
  return page.waitForFunction((wanted) => document.body.innerText.includes(wanted), { timeout }, text)
}

/** Picks `value` in a select once that option is there (a list loaded from the API, such as the job sectors). */
export async function selectOption(page, selector, value) {
  await page.waitForSelector(`${selector} option[value="${value}"]`)
  await page.select(selector, value)
}

/** Sets an input's value the way typing would (month and date inputs, which page.type cannot fill reliably). */
export async function setValue(page, selector, value) {
  await page.waitForSelector(selector)
  await page.$eval(
    selector,
    (element, next) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, next)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    },
    value,
  )
}

/** Picks "YYYY-MM" in a Month + Year field (the `${name}Month` and `${name}Year` selects). */
export async function pickMonth(page, name, value) {
  await page.select(`select[name="${name}Month"]`, value.slice(5, 7))
  await page.select(`select[name="${name}Year"]`, value.slice(0, 4))
}

/** Chooses a file in a file input. */
export async function chooseFile(page, selector, path) {
  // A file chosen while the input is still disabled (e.g. the CV dropzone until GET /meta/config has its rules) is
  // ignored by the browser, so wait until it is enabled.
  const input = await page.waitForSelector(`${selector}:not([disabled])`)
  await input.uploadFile(path)
}

/** Calls the API from the signed-in page (its token in localStorage), as the browser would. */
export function pageApi(page, path, init = {}) {
  return page.evaluate(
    async (url, options) => {
      const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${localStorage.getItem('lwm-auth-token')}`, ...options.headers } })
      return { status: response.status, body: await response.json().catch(() => null) }
    },
    `/api/v1${path}`,
    init,
  )
}

/** Ticks or unticks a DS checkbox (its native input is visually hidden) through its label, centred first. */
export async function toggleCheckbox(page, name) {
  const label = await page.waitForSelector(`label:has(input[name="${name}"])`)
  await label.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await label.click()
}
