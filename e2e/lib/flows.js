/* Browser steps shared by scenarios. */

/** Types into a field after clearing it. */
export async function fill(page, selector, value) {
  await page.waitForSelector(selector)
  await page.$eval(selector, (element) => {
    element.value = ''
  })
  await page.type(selector, value)
}

/** Waits until the path satisfies `test` (a string prefix or a function). */
export function waitForPath(page, test) {
  const predicate = typeof test === 'string' ? `location.pathname.startsWith(${JSON.stringify(test)})` : test
  return page.waitForFunction(predicate, { timeout: 15_000 })
}

/** Signs in through a sign-in form and waits until the URL leaves the sign-in page. */
export async function signInWithForm(page, webUrl, signInPath, email, password) {
  await page.goto(`${webUrl}${signInPath}`, { waitUntil: 'networkidle0' })
  await fill(page, 'input[name="email"]', email)
  await fill(page, 'input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForFunction((path) => location.pathname !== path, { timeout: 15_000 }, signInPath)
  await page.waitForNetworkIdle()
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

/** Chooses a file in a file input. */
export async function chooseFile(page, selector, path) {
  const input = await page.waitForSelector(selector)
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
