// TEMPORARY (perf 2026-11-24): browser checks for the performance/UX fixes; deleted after the run.
import { applyApi, completeCandidate, recruiterWithJob } from '../lib/applicants.js'
import { clickText, fill, pageApi, signInWithForm, waitForPath } from '../lib/flows.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Request interception with switchable rules: { method, part, delay, respond, abort, active, count }. */
async function intercept(page, rules) {
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const rule = rules.find((item) => item.active !== false && (!item.method || request.method() === item.method) && request.url().includes(item.part) && (!item.test || item.test(request.url())))
    if (!rule) return request.continue()
    rule.count = (rule.count ?? 0) + 1
    if (rule.abort) return request.abort()
    if (rule.respond) return request.respond(rule.respond)
    setTimeout(() => request.continue(), rule.delay ?? 0)
  })
}

const dialogs = (page) => page.$$eval('[role="dialog"]', (items) => items.length)

export default {
  name: 'TMP perf checks',
  viewports: ['D'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('PerfA')
    const candidate = await completeCandidate('Perfy')
    const { body: application } = await applyApi(candidate.token, job.id)

    // ---------- Candidate: Find jobs keeps its search; optimistic save; Back ----------
    const cand = await ctx.newPage()
    const { page } = cand
    const saveRule = { method: 'PUT', part: '/api/v1/candidate/saved-jobs/', delay: 1500 }
    const withdrawRule = { method: 'POST', part: '/withdraw', delay: 1500 }
    const listFail = { method: 'GET', part: '/api/v1/candidate/applications', test: (url) => /\/candidate\/applications(\?|$)/.test(url), respond: { status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL_ERROR"}}' }, active: false }
    await intercept(page, [saveRule, withdrawRule, listFail])
    cand.allow(500, '/candidate/applications')
    await signInWithForm(page, ctx.webUrl, '/sign-in', candidate.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/jobs`, { waitUntil: 'networkidle0' })
    await fill(page, 'input[aria-label="Search jobs"]', 'PerfA')
    await page.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'PerfA')
    const sortSelect = await page.evaluateHandle(() => [...document.querySelectorAll('select')].find((select) => [...select.options].some((option) => option.value === 'salary')))
    await sortSelect.select('newest')
    await page.waitForFunction(() => new URL(location.href).searchParams.get('sort') === 'newest')
    ctx.check(true, `search and sort are in the URL: ${new URL(page.url()).search}`)
    await page.waitForSelector(`article[data-job="${job.id}"]`)

    const bookmark = `article[data-job="${job.id}"] button[aria-pressed]`
    const before = await page.$eval(bookmark, (button) => button.getAttribute('aria-pressed'))
    await page.click(bookmark)
    await page.click(bookmark)
    await sleep(250)
    const during = await page.$eval(bookmark, (button) => button.getAttribute('aria-pressed'))
    ctx.check(before === 'false' && during === 'true', `save flips at once while the PUT is still out (${before} → ${during} after 250 ms)`)
    await sleep(2500)
    ctx.check(saveRule.count === 1, `a double click sends one save request (got ${saveRule.count})`)
    ctx.check((await page.$eval(bookmark, (button) => button.getAttribute('aria-pressed'))) === 'true', 'still saved after the server answered')

    await page.click(`article[data-job="${job.id}"] a[href="/candidate/jobs/${job.id}"]`)
    await waitForPath(page, `/candidate/jobs/${job.id}`)
    const backHref = await page.evaluate(() => [...document.querySelectorAll('a')].find((link) => link.textContent.includes('Back to opportunities'))?.getAttribute('href'))
    ctx.check(backHref?.includes('q=PerfA') && backHref.includes('sort=newest'), `the job page's Back keeps the search: ${backHref}`)
    await clickText(page, 'Back to opportunities', 'a')
    await page.waitForFunction(() => location.pathname === '/candidate/jobs')
    await page.waitForSelector(`article[data-job="${job.id}"]`)
    const restored = await page.evaluate(() => ({ q: document.querySelector('input[aria-label="Search jobs"]').value, sort: [...document.querySelectorAll('select')].find((select) => [...select.options].some((option) => option.value === 'salary')).value }))
    ctx.check(restored.q === 'PerfA' && restored.sort === 'newest', `Back link restores the list: ${JSON.stringify(restored)}`)
    await page.click(`article[data-job="${job.id}"] a[href="/candidate/jobs/${job.id}"]`)
    await waitForPath(page, `/candidate/jobs/${job.id}`)
    await page.goBack()
    await page.waitForSelector(`article[data-job="${job.id}"]`)
    const afterBrowserBack = await page.$eval('input[aria-label="Search jobs"]', (input) => input.value)
    ctx.check(afterBrowserBack === 'PerfA', `browser Back restores the search too (${afterBrowserBack})`)
    await ctx.screenshot(page, '1-find-jobs-restored')

    // ---------- Stacked dialogs: Escape closes only the top one; withdraw double click ----------
    await page.goto(`${ctx.webUrl}/candidate/applications`, { waitUntil: 'networkidle0' })
    await page.click(`[data-application="${application.id}"]`)
    await clickText(page, 'Withdraw application', '[role="dialog"] button')
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 2)
    await page.keyboard.press('Escape')
    await sleep(500)
    ctx.check((await dialogs(page)) === 1, `Escape closes only the confirm dialog (${await dialogs(page)} left open)`)
    await clickText(page, 'Withdraw application', '[role="dialog"] button')
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 2)
    const confirm = await page.evaluateHandle(() => [...document.querySelectorAll('[role="dialog"]')].at(-1).querySelector('footer button:last-child'))
    await confirm.click()
    await sleep(150)
    const busy = await page.evaluate(() => {
      const button = [...document.querySelectorAll('[role="dialog"]')].at(-1)?.querySelector('footer button:last-child')
      return button ? { disabled: button.disabled, busy: button.getAttribute('aria-busy') } : null
    })
    ctx.check(busy?.disabled === true, `the confirm button shows it is working (${JSON.stringify(busy)})`)
    await confirm.click().catch(() => {})
    await page.waitForFunction(() => document.querySelector('[data-status]')?.dataset.status === 'withdrawn', { timeout: 10_000 })
    ctx.check(withdrawRule.count === 1, `a double click withdraws once (got ${withdrawRule.count})`)
    await ctx.screenshot(page, '2-withdrawn')

    // ---------- LoadError with retry ----------
    listFail.active = true
    await page.goto(`${ctx.webUrl}/candidate/applications`, { waitUntil: 'networkidle0' })
    const errorShown = await page.evaluate(() => document.body.innerText.includes('We couldn’t load this'))
    ctx.check(errorShown, 'a failed list shows "We couldn’t load this" with a retry')
    await ctx.screenshot(page, '3-load-error')
    listFail.active = false
    await clickText(page, 'Try again', 'button')
    await page.waitForSelector(`[data-application="${application.id}"]`, { timeout: 10_000 })
    ctx.check(true, 'Try again loads the list')
    ctx.assertClean(cand.issues, 'candidate checks')

    // ---------- /me failure: RouteError instead of sign-in; static loader ----------
    const failing = await ctx.newPage()
    const meRule = { method: 'GET', part: '/api/v1/me', test: (url) => /\/api\/v1\/me(\?|$)/.test(url), respond: { status: 503, contentType: 'application/json', body: '{"error":{"code":"INTERNAL_ERROR"}}' }, active: false }
    const slowMain = { part: '/src/main.jsx', delay: 2000, active: false }
    await intercept(failing.page, [meRule, slowMain])
    await signInWithForm(failing.page, ctx.webUrl, '/sign-in', candidate.email, TEST_PASSWORD)
    meRule.active = true
    await failing.page.goto(`${ctx.webUrl}/candidate`, { waitUntil: 'networkidle0' })
    const routeError = await failing.page.evaluate(() => ({ path: location.pathname, text: document.body.innerText }))
    ctx.check(routeError.path === '/candidate' && routeError.text.includes('Something went wrong on our side') && routeError.text.includes('Reload'), `a 503 on /me keeps the user signed in with a Reload button (${routeError.path}: ${routeError.text.slice(0, 80)})`)
    await ctx.screenshot(failing.page, '4-route-error')
    meRule.respond = undefined
    meRule.abort = true
    await failing.page.goto(`${ctx.webUrl}/candidate`, { waitUntil: 'networkidle0' })
    const offline = await failing.page.evaluate(() => ({ path: location.pathname, text: document.body.innerText }))
    ctx.check(offline.path === '/candidate' && offline.text.includes('We couldn\'t reach the server'), `a network error on /me says so (${offline.path}: ${offline.text.slice(0, 80)})`)
    meRule.active = false
    slowMain.active = true
    await failing.page.goto(`${ctx.webUrl}/candidate`, { waitUntil: 'domcontentloaded' })
    const loader = await failing.page.$('#root img[src="/favicon.svg"]')
    ctx.check(Boolean(loader), 'a signed-in visitor sees the brand mark, not a white page, while the JS loads')
    await failing.page.waitForSelector('#root img[src="/favicon.svg"]', { hidden: true, timeout: 15_000 })
    ctx.check(true, 'the app replaces the static loader')

    // ---------- Recruiter: pipeline views keep the page; progress bar ----------
    const rec = await ctx.newPage()
    await signInWithForm(rec.page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await rec.page.goto(`${ctx.webUrl}/recruiter/hiring-pipeline`, { waitUntil: 'networkidle0' })
    await rec.page.evaluate(() => {
      document.querySelector('main > div').dataset.perfMark = '1'
    })
    const funnelLink = await rec.page.evaluateHandle(() => [...document.querySelectorAll('main a, main button')].find((item) => /funnel/i.test(item.textContent)))
    await funnelLink.click()
    await rec.page.waitForFunction(() => location.pathname.endsWith('/hiring-pipeline/funnel'))
    await sleep(400)
    const kept = await rec.page.evaluate(() => document.querySelector('main > div').dataset.perfMark === '1')
    ctx.check(kept, 'Board → Funnel keeps the page (no remount)')
    await rec.page.evaluate(() => {
      const seen = { progress: false }
      window.__perfSeen = seen
      new MutationObserver(() => {
        if (document.querySelector('div[class*="_progress_"]')) seen.progress = true
      }).observe(document.body, { childList: true, subtree: true })
    })
    const cdp = await rec.page.createCDPSession()
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 900, downloadThroughput: 200_000, uploadThroughput: 200_000 })
    const messagesLink = await rec.page.$('#workspace-sidebar a[href="/recruiter/messages"]')
    await messagesLink.click()
    await rec.page.waitForFunction(() => location.pathname === '/recruiter/messages', { timeout: 30_000 })
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    ctx.check(await rec.page.evaluate(() => window.__perfSeen.progress), 'a slow page load shows the top progress bar')
    ctx.assertClean(rec.issues, 'recruiter checks')

    // ---------- Start conversation double click; thread scroll ----------
    const reader = await completeCandidate('PerfReader')
    const sarah = await ctx.newPage()
    const startRule = { method: 'POST', part: '/api/v1/conversations', test: (url) => /\/conversations$/.test(url), delay: 1500 }
    await intercept(sarah.page, [startRule])
    await signInWithForm(sarah.page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await sarah.page.goto(`${ctx.webUrl}/recruiter/find-candidates/${reader.id}`, { waitUntil: 'networkidle0' })
    await clickText(sarah.page, 'Message', '[data-start-conversation]')
    await sarah.page.waitForSelector('[role="dialog"] textarea[name="body"]', { visible: true })
    const send = await sarah.page.evaluateHandle(() => [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent.includes('Send message')))
    await send.click()
    await send.click().catch(() => {})
    await waitForPath(sarah.page, () => /^\/recruiter\/messages\/\w+$/.test(location.pathname))
    ctx.check(startRule.count === 1, `a double click on Send message starts one conversation (got ${startRule.count})`)
    const threadId = sarah.page.url().split('/').pop()
    for (let index = 0; index < 18; index++) {
      const sent = await pageApi(sarah.page, `/conversations/${threadId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: `Older message ${index + 1}: ${"lorem ipsum ".repeat(8)}` }) })
      if (sent.status >= 400) {
        ctx.note(`message ${index + 1} refused: ${sent.status} ${JSON.stringify(sent.body).slice(0, 120)}`)
        break
      }
    }
    await sarah.page.reload({ waitUntil: 'networkidle0' })
    await sleep(800)
    const atEnd = await sarah.page.evaluate(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 200)
    ctx.check(atEnd, 'opening a long thread starts at the newest message')
    await sarah.page.evaluate(() => window.scrollTo(0, 0))
    await sleep(300)
    await api2(reader, threadId)
    // The thread polls every 15 s; wait for the new message to arrive.
    await sarah.page.waitForFunction(() => document.body.innerText.includes('Reply from the reader'), { timeout: 25_000 })
    await sleep(600)
    const scrollY = await sarah.page.evaluate(() => window.scrollY)
    ctx.check(scrollY < 50, `reading older messages, a new message doesn't pull the page down (scrollY ${scrollY})`)
    await ctx.screenshot(sarah.page, '5-thread-reading')
    ctx.assertClean(sarah.issues, 'messages checks')
  },
}

/** The reader replies from Node (their token). */
async function api2(reader, threadId) {
  const { api } = await import('../lib/testApi.js')
  const reply = await api(`/conversations/${threadId}/messages`, { method: 'POST', token: reader.token, body: { body: 'Reply from the reader' } })
  if (reply.status >= 400) throw new Error(`reader reply failed: ${reply.status} ${JSON.stringify(reply.body)}`)
}
