import { ROUTES } from '../routes.js'
import { signInWithForm } from './flows.js'
import { checkLayout, findLeftovers, textsFor } from './i18nChecks.js'
import { db } from './testApi.js'

/*
 * Visits every route of e2e/routes.js per group, signed in through the sign-in form with the seeded accounts (no
 * session for `public`), in one UI language. A route fails on any page check (console errors include a missing
 * i18n key), a redirect away from it, the 404 panel, the router error screen, a near-empty page, a layout problem
 * (lib/i18nChecks.js) and, outside English, an English leftover.
 */
const GROUPS = {
  public: null,
  candidate: { signIn: '/sign-in', account: 'alex' },
  // James is still onboarding, so these are the pages he can reach.
  recruiterOnboarding: { signIn: '/recruiter/sign-in', account: 'james' },
  recruiter: { signIn: '/recruiter/sign-in', account: 'sarah' },
  admin: { signIn: '/admin/sign-in', account: null },
}
// The onboarding layout opens the first step that is still open, so those pages may redirect by design.
const REDIRECTS_ALLOWED = new Set(['recruiterOnboarding'])

async function visit(ctx, handle, group, path, texts, label) {
  const { page } = handle
  handle.issues.length = 0
  await page.goto(`${ctx.webUrl}${path}`, { waitUntil: 'networkidle0' })
  // Entrance animations fade blocks in; measure the settled layout.
  await new Promise((resolve) => setTimeout(resolve, 450))
  await handle.checkOverflow()
  const state = await page.evaluate(() => ({
    path: location.pathname,
    language: document.documentElement.lang,
    notFound: document.querySelector('[data-not-found]') !== null || [...document.querySelectorAll('h1')].some((h1) => h1.textContent.trim() === 'Page not found'),
    routerError: document.body.innerText.includes('Unexpected Application Error'),
    textLength: document.body.innerText.trim().length,
  }))
  await ctx.screenshot(page, `${label}${group}${path}`)

  const layout = await checkLayout(page, texts)
  const problems = [...handle.issues, ...layout.problems]
  if (texts.language !== 'en') problems.push(...(await findLeftovers(page, texts)))
  if (state.language !== texts.language) problems.push(`<html lang> is ${state.language}`)
  if (!REDIRECTS_ALLOWED.has(group) && state.path !== path) problems.push(`landed on ${state.path}`)
  if (state.notFound) problems.push('404 page')
  if (state.routerError) problems.push('router error screen')
  if (state.textLength < 50) problems.push('near-empty page')
  return { problems, notes: layout.notes }
}

/** The seeded ids behind the route placeholders. */
async function routeIds(ctx) {
  const [acme] = await db('companies', 'find', { filter: { displayName: 'Acme Studio' } })
  const [job] = await db('jobs', 'find', { filter: { companyId: acme._id, title: 'Product Designer, Growth' } })
  const [emma] = await db('users', 'find', { filter: { email: ctx.seedCredentials.email('emma') } })
  const [sarah] = await db('users', 'find', { filter: { email: ctx.seedCredentials.email('sarah') } })
  const [thread] = await db('conversations', 'find', { filter: { companyId: acme._id, candidateId: emma._id } })
  const course = async (title) => (await db('courses', 'find', { filter: { title } }))[0]
  const candidateCourse = await course('Interaction design foundations')
  const recruiterCourse = await course('Hiring Technology & Product Talent')
  const id = (doc) => doc._id.$oid ?? doc._id
  return {
    job: id(job),
    emma: id(emma),
    sarah: id(sarah),
    thread: id(thread),
    candidateCourse: id(candidateCourse),
    candidateLesson: id(candidateCourse.lessons[0]),
    recruiterCourse: id(recruiterCourse),
    recruiterLesson: id(recruiterCourse.lessons[0]),
  }
}

/**
 * Sweeps every route (or the `routes` given, same shape as ROUTES) in `language`. Outside English the seeded accounts get that language (explicit) for the run and
 * their own values back afterwards; the anonymous visitor's choice is set in this browser's storage.
 */
export async function sweepRoutes(ctx, language, routes = ROUTES) {
  const ids = await routeIds(ctx)
  const resolve = (path) => path.replace(/:(\w+)/g, (match, name) => ids[name] ?? match)
  const texts = { ...textsFor(language), language }
  const label = language === 'en' ? '' : `${language}-`
  const emails = Object.values(GROUPS)
    .filter(Boolean)
    .map((login) => ctx.seedCredentials.email(login.account))
  const before = await db('users', 'find', { filter: { email: { $in: emails } } })
  const failures = []
  const notes = new Set()
  const counts = []
  try {
    if (language !== 'en') await db('users', 'updateMany', { filter: { email: { $in: emails } }, update: { $set: { language, languageExplicit: true } } })
    for (const [group, paths] of Object.entries(routes)) {
      const handle = await ctx.newPage()
      await handle.page.evaluateOnNewDocument((value) => {
        try {
          window.localStorage.setItem('lwm-pref-language', value)
        } catch {
          // no storage: the browser language applies
        }
      }, language)
      const login = GROUPS[group]
      if (login) {
        await signInWithForm(handle.page, ctx.webUrl, login.signIn, ctx.seedCredentials.email(login.account), ctx.seedCredentials.password)
      }
      for (const path of paths.map(resolve)) {
        const { problems, notes: found } = await visit(ctx, handle, group, path, texts, label)
        if (problems.length) failures.push(`${group} ${path}: ${problems.join('; ')}`)
        for (const note of found) notes.add(`${group} ${path}: ${note}`)
      }
      counts.push(`${group} ${paths.length}`)
    }
  } finally {
    for (const user of before) {
      await db('users', 'updateMany', { filter: { email: user.email }, update: { $set: { language: user.language, languageExplicit: user.languageExplicit ?? false } } })
    }
  }
  return { failures, notes: [...notes], counts }
}
