import { signInWithForm, waitForText } from '../lib/flows.js'
import { embeddingOf, expectedRelevant, sarah, tick, toDate } from '../lib/matching.js'
import { api, date, db } from '../lib/testApi.js'

const HOUR_MS = 60 * 60 * 1000
const nightlyRun = async () => toDate((await db('jobruns', 'find', { filter: { name: 'relevance-nightly' } }))[0]?.lastRunAt)

/**
 * P9-04 (M-051, U7, C7): a job's "N relevant" equals its market population with a score ≥ Good. Editing the brief
 * re-embeds the job and recomputes the count on the next tick. A tick at 03:00 server time runs the nightly job, and
 * after 25 h without a run the startup tick catches up.
 */
export default {
  name: 'P9-04 Relevance',
  viewports: ['D'],
  async run(ctx) {
    const { token, job } = await sarah(ctx)
    const expected = await expectedRelevant(token, job)
    ctx.check(job.relevantCount === expected, `"${job.title}": ${job.relevantCount} relevant = ${expected} (population with score ≥ Good)`)

    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', ctx.seedCredentials.email('sarah'), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/recruiter/jobs/${job.id}`, { waitUntil: 'networkidle0' })
    await waitForText(page, `${expected} relevant`)
    await ctx.screenshot(page, '1-relevant-count')

    // Editing the brief changes the job text: a new embedding and a recount on the next tick.
    const before = await embeddingOf(job.id)
    const full = (await api(`/recruiter/jobs/${job.id}`, { token })).body
    const body = {
      title: full.title,
      employmentType: full.employmentType,
      brief: `${full.brief} The role also leads accessibility reviews across the product.`,
      responsibilities: full.responsibilities,
      requiredSkills: full.requiredSkills,
      preferredSkills: full.preferredSkills,
      level: full.level,
      experienceYears: full.experienceYears,
      requiredLanguages: full.requiredLanguages,
      workPreference: full.workPreference,
      placeId: full.location?.placeId,
      remoteCountries: full.remoteCountries,
      salary: full.salary && { min: full.salary.min, max: full.salary.max, period: full.salary.period },
      visaSponsorship: full.visaSponsorship,
    }
    const saved = await api(`/recruiter/jobs/${job.id}`, { method: 'PUT', token, body })
    ctx.check(saved.status === 200, `the brief is saved (${saved.status} ${JSON.stringify(saved.body?.error ?? '')})`)
    await tick()
    const after = await embeddingOf(job.id)
    ctx.check(after && after.sourceHash !== before.sourceHash, 'the job was embedded again')
    const edited = (await api(`/recruiter/jobs/${job.id}`, { token })).body
    const recount = await expectedRelevant(token, edited)
    ctx.check(edited.relevantCount === recount, `after the edit: ${edited.relevantCount} relevant = ${recount}`)
    await page.reload({ waitUntil: 'networkidle0' })
    await waitForText(page, `${recount} relevant`)
    await ctx.screenshot(page, '2-after-edit')

    // 03:00 server time (this machine's time zone): the nightly slot runs once.
    const three = new Date()
    three.setHours(3, 0, 0, 0)
    await db('jobruns', 'updateMany', { filter: { name: 'relevance-nightly' }, update: { $set: { lastRunAt: date(three.getTime() - 25 * HOUR_MS) } } })
    await tick(three)
    ctx.check((await nightlyRun()).getTime() === three.getTime(), 'a tick at 03:00 runs relevance-nightly')
    await tick(new Date(three.getTime() + 10 * 60 * 1000))
    ctx.check((await nightlyRun()).getTime() === three.getTime(), 'a later tick the same night does not run it again')

    // The server was off for 25 h: the startup tick (any time of day) catches up.
    await db('jobruns', 'updateMany', { filter: { name: 'relevance-nightly' }, update: { $set: { lastRunAt: date(Date.now() - 25 * HOUR_MS) } } })
    const startup = new Date()
    await tick(startup)
    ctx.check((await nightlyRun()).getTime() === startup.getTime(), 'the startup tick catches up after 25 h')
    const final = (await api(`/recruiter/jobs/${job.id}`, { token })).body
    ctx.check(final.relevantCount === (await expectedRelevant(token, final)), 'the count still matches after the nightly recompute')
    ctx.assertClean(handle.issues, 'relevance')
  },
}
