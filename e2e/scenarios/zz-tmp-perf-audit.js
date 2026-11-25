// TEMPORARY (perf audit 2026-11-25): measures every route, then deleted. Not part of `all`.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROUTES } from '../routes.js'
import { signInWithForm } from '../lib/flows.js'
import { db } from '../lib/testApi.js'

const GROUPS = {
  public: null,
  candidate: { signIn: '/sign-in', account: 'alex' },
  recruiter: { signIn: '/recruiter/sign-in', account: 'sarah' },
  admin: { signIn: '/admin/sign-in', account: null },
}
const EXTRA_PUBLIC = ['/', '/jobs', '/pricing', '/blog', '/agencies']
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function routeIds(ctx) {
  const id = (doc) => doc._id.$oid ?? doc._id
  const [acme] = await db('companies', 'find', { filter: { displayName: 'Acme Studio' } })
  const [job] = await db('jobs', 'find', { filter: { companyId: acme._id, title: 'Product Designer, Growth' } })
  const [emma] = await db('users', 'find', { filter: { email: ctx.seedCredentials.email('emma') } })
  const [sarah] = await db('users', 'find', { filter: { email: ctx.seedCredentials.email('sarah') } })
  const [thread] = await db('conversations', 'find', { filter: { companyId: acme._id, candidateId: emma._id } })
  const course = async (title) => (await db('courses', 'find', { filter: { title } }))[0]
  const cc = await course('Interaction design foundations')
  const rc = await course('Hiring Technology & Product Talent')
  return { job: id(job), emma: id(emma), sarah: id(sarah), thread: id(thread), candidateCourse: id(cc), candidateLesson: id(cc.lessons[0]), recruiterCourse: id(rc), recruiterLesson: id(rc.lessons[0]) }
}

/** Tracks /api requests on a page: count, duplicates, server time. */
function trackApi(page) {
  let log = []
  let pending = 0
  page.on('request', (req) => {
    if (req.url().includes('/api/v1/')) pending++
  })
  const done = (res) => {
    const req = res.request()
    if (!req.url().includes('/api/v1/')) return
    pending--
    const t = res.timing()
    log.push({ key: `${req.method()} ${req.url().replace(/^https?:\/\/[^/]+/, '')}`, ms: t ? Math.round(t.receiveHeadersEnd - t.sendStart) : null, status: res.status() })
  }
  page.on('response', done)
  page.on('requestfailed', (req) => req.url().includes('/api/v1/') && pending--)
  return {
    reset: () => (log = []),
    take: () => log,
    async idle(quietMs = 400, maxMs = 15_000) {
      const start = Date.now()
      let quietSince = Date.now()
      while (Date.now() - start < maxMs) {
        if (pending > 0) quietSince = Date.now()
        else if (Date.now() - quietSince >= quietMs) return Date.now() - start - quietMs
        await wait(50)
      }
      return maxMs
    },
  }
}

function summarize(log) {
  const counts = {}
  for (const entry of log) counts[entry.key] = (counts[entry.key] ?? 0) + 1
  const dups = Object.entries(counts).filter(([, n]) => n > 1).map(([key, n]) => `${key} x${n}`)
  const slow = log.filter((entry) => entry.ms > 300).map((entry) => `${entry.key} ${entry.ms}ms`)
  return { calls: log.length, dups, slow, maxMs: Math.max(0, ...log.map((entry) => entry.ms ?? 0)) }
}

const overflowAt = (page, width) =>
  page.setViewport({ width, height: width < 500 ? 812 : 1024 }).then(async () => {
    await wait(350)
    return page.evaluate(() => {
      const w = document.documentElement.clientWidth
      const over = document.documentElement.scrollWidth - w
      if (over <= 0) return null
      const wide = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > w + 0.5)
      const inner = wide.filter((el) => !wide.some((o) => o !== el && el.contains(o))).slice(0, 2)
      return `${over}px: ${inner.map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`).join(', ')}`
    })
  })

export default {
  name: 'TMP perf audit',
  viewports: ['D'],
  async run(ctx) {
    const ids = await routeIds(ctx)
    const resolve = (path) => path.replace(/:(\w+)/g, (match, name) => ids[name] ?? match)
    const rows = []
    const leaks = {}
    for (const [group, login] of Object.entries(GROUPS)) {
      const handle = await ctx.newPage()
      const { page } = handle
      const api = trackApi(page)
      await page.evaluateOnNewDocument(() => {
        window.__cls = 0
        window.__long = 0
        new PerformanceObserver((list) => list.getEntries().forEach((e) => !e.hadRecentInput && (window.__cls += e.value))).observe({ type: 'layout-shift', buffered: true })
        new PerformanceObserver((list) => list.getEntries().forEach((e) => (window.__long += e.duration))).observe({ type: 'longtask', buffered: true })
      })
      if (login) await signInWithForm(page, ctx.webUrl, login.signIn, ctx.seedCredentials.email(login.account), ctx.seedCredentials.password)
      const paths = (group === 'public' ? [...EXTRA_PUBLIC, ...ROUTES.public] : ROUTES[group]).map(resolve)
      // 1. Full load of each route.
      for (const path of paths) {
        await page.setViewport({ width: 1440, height: 900 })
        api.reset()
        const t0 = Date.now()
        await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'load' })
        await api.idle()
        const loadMs = Date.now() - t0
        await wait(600)
        const perf = await page.evaluate(() => ({ cls: Math.round(window.__cls * 1000) / 1000, long: Math.round(window.__long), nodes: document.getElementsByTagName('*').length }))
        const tablet = await overflowAt(page, 768)
        const phone = await overflowAt(page, 375)
        rows.push({ group, path, loadMs, ...perf, ...summarize(api.take()), tablet, phone })
      }
      // 2. In-app navigation (no reload) three times through the group's routes: time per route and DOM/heap growth.
      if (login) {
        await page.setViewport({ width: 1440, height: 900 })
        await page.goto(`${ctx.webUrl}${paths[0]}`, { waitUntil: 'load' })
        await api.idle()
        const cdp = await page.createCDPSession()
        const measure = async () => {
          await cdp.send('HeapProfiler.collectGarbage')
          await wait(300)
          const dom = await cdp.send('Memory.getDOMCounters')
          const { metrics } = await cdp.send('Performance.getMetrics')
          const heap = metrics.find((m) => m.name === 'JSHeapUsedSize').value
          return { nodes: dom.nodes, listeners: dom.jsEventListeners, heapMb: Math.round(heap / 1e5) / 10 }
        }
        await cdp.send('Performance.enable')
        const cycles = []
        const spa = {}
        for (let cycle = 0; cycle < 3; cycle++) {
          for (const path of paths.filter((p) => !p.includes('/checkout/'))) {
            api.reset()
            const t0 = Date.now()
            await page.evaluate((to) => {
              window.history.pushState({}, '', to)
              window.dispatchEvent(new PopStateEvent('popstate'))
            }, path)
            await wait(30)
            const ms = (await api.idle(300)) + 30
            const s = summarize(api.take())
            if (cycle === 1) spa[path] = { ms, calls: s.calls, dups: s.dups }
            void t0
          }
          await page.evaluate((to) => {
            window.history.pushState({}, '', to)
            window.dispatchEvent(new PopStateEvent('popstate'))
          }, paths[0])
          await api.idle(500)
          cycles.push(await measure())
        }
        leaks[group] = { cycles, spa }
      }
    }
    writeFileSync(join(ctx.runDir, 'perf.json'), JSON.stringify({ rows, leaks }, null, 2))
    ctx.note(`perf.json written (${rows.length} routes)`)
  },
}
