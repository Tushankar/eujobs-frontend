import { responseTo, waitForPath } from './flows.js'
import { api } from './testApi.js'

/*
 * Phase 11b helpers: the header bell (count and dropdown), the sidebar section counts and the API view of a user's
 * notifications. The counts refresh with the 15 s counters poll, so waits allow 25 s.
 */
const POLL_WAIT = 25_000

/** The bell's unread number (0 when it shows none). */
export const bellCount = (page) => page.$eval('[data-bell]', (bell) => Number(bell.querySelector('[data-bell-count]')?.textContent ?? 0))

export function waitForBell(page, count) {
  return page.waitForFunction((wanted) => Number(document.querySelector('[data-bell] [data-bell-count]')?.textContent ?? 0) === wanted, { timeout: POLL_WAIT }, count)
}

/** The sidebar notification count of a nav item (0 when it shows none). */
export const sectionCount = (page, section) => page.evaluate((key) => Number(document.querySelector(`[data-notification-badge="${key}"]`)?.textContent ?? 0), section)

export function waitForSection(page, section, count) {
  return page.waitForFunction(
    (key, wanted) => Number(document.querySelector(`[data-notification-badge="${key}"]`)?.textContent ?? 0) === wanted,
    { timeout: POLL_WAIT },
    section,
    count,
  )
}

/** Opens the bell dropdown and waits for its list (or empty state) to load. */
export async function openBell(page) {
  const loaded = responseTo(page, '/api/v1/notifications')
  await page.click('[data-bell]')
  await loaded
  await page.waitForSelector('[data-notifications-panel]', { visible: true })
  // The panel's entrance animation (Dropdown) makes it transparent for a moment.
  await new Promise((resolve) => setTimeout(resolve, 300))
}

/** The rows of the open dropdown or page: type, text and read state. */
export const rowsOf = (page, scope = '[data-notifications-panel]') =>
  page.$$eval(`${scope} [data-notification]`, (rows) => rows.map((row) => ({ type: row.dataset.notification, read: row.dataset.read === 'true', text: row.innerText })))

/** Clicks the first row of `type` in `scope` and waits for the path the server answers. */
export async function clickNotification(page, type, path, scope = '[data-notifications-panel]') {
  const opened = responseTo(page, '/open', 'POST')
  await page.click(`${scope} [data-notification="${type}"]`)
  const answer = await (await opened).json()
  if (path) await waitForPath(page, path)
  return answer
}

/** The user's notifications through the API. */
export const notificationsOf = async (token, query = '') => (await api(`/notifications${query}`, { token })).body

export const countersOf = async (token) => (await api('/me/counters', { token })).body.notifications
