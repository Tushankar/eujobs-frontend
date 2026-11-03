import { api } from './testApi.js'

/* Phase 7 helpers: the Messages badge, conversations and job alerts through the API. */

function check(result, what) {
  if (result.status >= 300) throw new Error(`${what} failed: ${result.status} ${JSON.stringify(result.body?.error ?? {})}`)
  return result.body
}

/** Waits until the Messages sidebar badge shows `count` (null = hidden), within one 15 s poll plus margin. */
export function waitForMessagesBadge(page, count) {
  return page.waitForFunction(
    (wanted) => (document.querySelector('[data-nav-badge="messages"]')?.textContent ?? null) === wanted,
    { timeout: 20_000 },
    count === null ? null : String(count),
  )
}

export const startApi = (token, body) => api('/conversations', { method: 'POST', token, body })
export const sendApi = (token, id, body) => api(`/conversations/${id}/messages`, { method: 'POST', token, body: { body } })
export const unreadOf = async (token) => check(await api('/me/counters', { token }), 'counters').unreadMessages

export const createAlertApi = async (token, body) => check(await api('/candidate/job-alerts', { method: 'POST', token, body: { frequency: 'instant', ...body } }), 'create alert')
export const alertsOf = async (token) => check(await api('/candidate/job-alerts', { token }), 'alerts')

const DAY_MS = 24 * 60 * 60 * 1000

/** The instant of `hour`:00 local time in `timeZone`, `daysAhead` days after today there (e.g. tomorrow 08:00 in Madrid). */
export function localHour(timeZone, daysAhead, hour) {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(Date.now() + daysAhead * DAY_MS)).split('-').map(Number)
  const guess = Date.UTC(year, month - 1, day, hour)
  const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).format(new Date(guess)).match(/GMT([+-]\d{2}):?(\d{2})?/)
  const minutes = offset ? Number(offset[1]) * 60 + Math.sign(Number(offset[1])) * Number(offset[2] ?? 0) : 0
  return new Date(guess - minutes * 60 * 1000)
}

/** Fills the job alert dialog (keyboard-cleared fields) and submits it. */
export async function fillAlertForm(page, { name, keywords, frequency }) {
  for (const [selector, value] of [
    ['input[name="alertName"]', name],
    ['input[name="keywords"]', keywords],
  ]) {
    await page.click(selector, { count: 3 })
    await page.keyboard.press('Backspace')
    await page.type(selector, value)
  }
  if (frequency) await page.select('select[name="frequency"]', frequency)
}
