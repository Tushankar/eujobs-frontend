import { PLACES } from '../../server/seed/data/places.js'
import { fixture } from '../fixtures/make.js'
import { onboardedCandidate, uploadAs } from './candidates.js'
import { subscribeThroughApi, waitForPlan } from './payments.js'
import { approvedRecruiter, jobBody, postJob } from './recruiters.js'
import { api, db } from './testApi.js'

/*
 * Phase 6 helpers. A candidate who passes the apply gate is built through the real API (profile, entries, photo, CV,
 * phone code) plus a real Plus subscription through Stripe (as P5's setups). Only the three admin-approved checks are
 * written straight to the test database: their review is Phase 3's subject, not this phase's.
 */
function check(result, what) {
  if (result.status >= 300) throw new Error(`${what} failed: ${result.status} ${JSON.stringify(result.body?.error ?? {})}`)
  return result.body
}

/** A complete candidate (all 12 checklist items) with Plus unless `plus: false`; returns { email, token, id, fullName }. */
export async function completeCandidate(label, { plus = true, language = 'en' } = {}) {
  const { email, token } = await onboardedCandidate(label, { language })
  const me = check(await api('/me', { token }), 'me')
  const put = (path, body) => api(path, { method: 'PUT', token, body }).then((result) => check(result, path))
  const post = (path, body) => api(path, { method: 'POST', token, body }).then((result) => check(result, path))

  await put('/candidate/profile', {
    fullName: me.fullName,
    headline: 'Product Designer',
    placeId: PLACES.london.placeId,
    about: 'A product designer who builds calm, accessible tools for teams.',
    yearsExperience: 5,
    skills: ['Figma', 'Design Systems', 'Prototyping'],
    workPreference: 'hybrid',
    availability: 'available_now',
  })
  const work = await post('/candidate/profile/work-history', { title: 'Product Designer', employer: 'Studio North', start: '2020-01', current: true })
  await post('/candidate/profile/education', { institution: 'Art School', degree: 'BA Design', start: '2014-09', end: '2018-06' })
  await put('/candidate/profile/languages', { languages: [{ code: 'en', level: 'native' }] })
  await put('/candidate/profile/right-to-work', { rightToWork: [{ region: 'uk', status: 'citizen_settled' }] })
  check(await uploadAs(token, '/candidate/profile/photo', fixture('photo.jpg'), 'image/jpeg'), 'photo')
  check(await uploadAs(token, '/candidate/cv/versions', fixture('cv-text.pdf'), 'application/pdf'), 'cv')
  const { code } = await post('/candidate/verification/phone/code', { phone: '+44 20 7946 0123' })
  await post('/candidate/verification/phone/confirm', { code })
  const userId = { $oid: me.id }
  for (const category of ['identity', 'academic', 'employment']) {
    await db('verificationsubmissions', 'insertOne', { doc: { userId, category, status: 'approved', submittedAt: { $date: new Date().toISOString() }, entryId: category === 'employment' ? { $oid: work.workHistory[0].id } : undefined } })
  }
  // The last profile write stores the completeness with the approvals counted (discovery reads the stored flag).
  await put('/candidate/profile/links', { portfolio: 'https://portfolio.example.com' })

  if (plus) {
    await subscribeThroughApi({ ...me, email })
    await waitForPlan(token, 'plus')
  }
  const final = check(await api('/me', { token }), 'me')
  if (!final.completeness.complete) throw new Error(`profile not complete: ${JSON.stringify(final.completeness.items.filter((item) => !item.done))}`)
  return { email, token, id: me.id, fullName: me.fullName }
}

/** An approved recruiter with one published London job; returns { recruiter, job }. */
export async function recruiterWithJob(label, jobOverrides = {}) {
  const recruiter = await approvedRecruiter(label)
  const job = await postJob(recruiter.token, jobBody({ title: `${label} Designer`, ...jobOverrides }))
  return { recruiter, job }
}

/** POST /candidate/applications from Node. */
export const applyApi = (token, jobId, body = {}) => api('/candidate/applications', { method: 'POST', token, body: { jobId, consent: true, ...body } })

/** One scheduler tick `ms` from now (§2.13). */
export const tickIn = (ms) => api('/_test/scheduler/tick', { method: 'POST', body: { now: new Date(Date.now() + ms).toISOString() } })

export const MINUTE = 60 * 1000

/** Clicks the first visible Apply button of the page, centred first so the sticky header never covers it. */
export async function clickApply(page, selector = '[data-apply]') {
  const button = await page.waitForSelector(selector, { visible: true })
  await button.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await button.click()
}

/** Sets a textarea's value the way typing would (a long cover note types slowly). */
export async function setTextarea(page, selector, value) {
  await page.$eval(
    selector,
    (element, next) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, next)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    },
    value,
  )
}

/** Picks an option of a stage select by the option's visible text. */
export async function chooseStage(page, selector, name) {
  const value = await page.$eval(selector, (select, wanted) => [...select.options].find((option) => option.textContent === wanted)?.value, name)
  if (!value) throw new Error(`no stage option ${name}`)
  await page.select(selector, value)
}
