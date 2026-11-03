import { clickText, waitForText } from '../lib/flows.js'
import { inCountry } from '../lib/matching.js'
import { openAs } from '../lib/payments.js'
import { login } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const profileOf = (token) => api('/candidate/profile', { token }).then((result) => result.body)

/**
 * P9-07 (M-063 … M-067, P9-Q2): Emma's insights pages. The role picker offers the top 10 + saved + applied jobs and
 * defaults to the top one; the overview narrative is written; "I have this skill" adds a skill and undoes it, and a 13th
 * skill is refused; the learning plan keeps a skill after a reload, Learning names it, and removing it sticks; "Save
 * this opportunity" uses the saved jobs; feedback is stored. A Free candidate meets the plan gate.
 */
export default {
  name: 'P9-07 Insights pages',
  viewports: ['D', 'M'],
  async run(ctx) {
    const email = ctx.seedCredentials.email('emma')
    const token = await login(email, 'candidate', ctx.seedCredentials.password)
    const original = (await profileOf(token)).skills
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(422, '/api/v1/candidate/profile/skills')

    await inCountry(token, 'REMOTE', async () => {
      try {
        // Role picker (M-063): top 10 recommendations, then saved and applied jobs; the first is the default.
        const roles = (await api('/candidate/insights/roles', { token })).body.items
        const recommended = (await api('/jobs/recommended', { token })).body.items.slice(0, 10).map((job) => job.id)
        ctx.check(JSON.stringify(roles.slice(0, recommended.length).map((job) => job.id)) === JSON.stringify(recommended), 'the picker starts with the top 10 recommendations')

        await openAs(ctx, handle, email, '/candidate/ai-insights', ctx.seedCredentials.password)
        await page.waitForSelector('[data-narrative="overview"] p:not([data-ai-state])', { visible: true, timeout: 60_000 })
        await page.waitForSelector('[data-match-card]', { visible: true })
        await handle.checkOverflow()
        await ctx.screenshot(page, '1-overview')

        await page.goto(`${ctx.webUrl}/candidate/ai-insights/skill-gap`, { waitUntil: 'networkidle0' })
        await page.waitForSelector('select[name="role"]')
        ctx.check((await page.$eval('select[name="role"]', (select) => select.value)) === roles[0].id, 'the picker defaults to the top-ranked job')
        // A role with a gap: the first one whose evidence lists a missing required skill.
        let gapJob = null
        for (const role of roles) {
          const { evidence } = (await api(`/candidate/insights/skill-gap?jobId=${role.id}`, { token })).body
          if (evidence.missingSkills.length) {
            gapJob = { id: role.id, skill: evidence.missingSkills[0] }
            break
          }
        }
        ctx.check(gapJob, 'a role with a missing required skill')
        await page.select('select[name="role"]', gapJob.id)
        const card = `[data-gap="${gapJob.skill}"]`
        await page.waitForSelector(card, { visible: true })

        // "I have this skill" → review → added to the profile; Undo removes it.
        await clickText(page, 'I have this skill', `${card} button`)
        await page.waitForSelector('[role="dialog"] label', { visible: true })
        await page.click('[role="dialog"] label')
        await clickText(page, 'Add reviewed skill', '[role="dialog"] button')
        await waitForText(page, 'Added · Candidate-reviewed')
        ctx.check((await profileOf(token)).skills.includes(gapJob.skill), `${gapJob.skill} is on the profile`)
        await ctx.screenshot(page, '2-skill-added')
        await clickText(page, 'Undo', `${card} button`)
        await page.waitForFunction((selector) => document.querySelector(selector)?.innerText.includes('Required · Not listed'), {}, card)
        ctx.check(!(await profileOf(token)).skills.includes(gapJob.skill), 'Undo removes it')

        // Learning plan (P9-Q2): add, survives a reload, Learning names it; remove, gone after a reload.
        await page.click(`[data-plan-toggle="${gapJob.skill}"]`)
        await page.waitForSelector(`[data-learning-plan] [data-plan-skill="${gapJob.skill}"]`, { visible: true })
        await page.reload({ waitUntil: 'networkidle0' })
        await page.waitForSelector(`[data-learning-plan] [data-plan-skill="${gapJob.skill}"]`, { visible: true })
        const suggestions = (await api('/learning/suggestions', { token })).body
        ctx.check([...suggestions.gapSkills, ...suggestions.planSkills].includes(gapJob.skill), 'Learning ranks by the plan skill too')
        const learning = await ctx.newPage(handle.page.browserContext())
        await learning.page.goto(`${ctx.webUrl}/candidate/learning`, { waitUntil: 'networkidle0' })
        if (suggestions.planSkills.includes(gapJob.skill)) await waitForText(learning.page, `Your learning plan adds: ${gapJob.skill}`)
        await ctx.screenshot(learning.page, '3-learning')
        await learning.page.close()
        await ctx.screenshot(page, '4-plan')
        await page.click(`[data-learning-plan] [data-plan-skill="${gapJob.skill}"] button`)
        await page.waitForFunction((skill) => !document.querySelector(`[data-learning-plan] [data-plan-skill="${skill}"]`), {}, gapJob.skill)
        await page.reload({ waitUntil: 'networkidle0' })
        await page.waitForSelector('[data-learning-plan]', { visible: true })
        ctx.check(!(await page.$(`[data-learning-plan] [data-plan-skill="${gapJob.skill}"]`)), 'removal persists after a reload')

        // A 13th skill is refused (M-064).
        const filler = Array.from({ length: 12 }, (_, index) => ({ name: `Filler skill ${index + 1}`, key: `filler skill ${index + 1}` }))
        await db('candidateprofiles', 'updateMany', { filter: { userId: { $oid: (await api('/me', { token })).body.id } }, update: { $set: { skills: filler } } })
        await page.reload({ waitUntil: 'networkidle0' })
        await page.waitForSelector(card, { visible: true })
        await clickText(page, 'I have this skill', `${card} button`)
        await page.waitForSelector('[role="dialog"] label', { visible: true })
        await page.click('[role="dialog"] label')
        await clickText(page, 'Add reviewed skill', '[role="dialog"] button')
        await page.waitForSelector('[role="dialog"] [role="alert"]', { visible: true })
        ctx.note(`13th skill: ${await page.$eval('[role="dialog"] [role="alert"]', (element) => element.textContent)}`)
        ctx.check((await profileOf(token)).skills.length === 12, 'the profile keeps 12 skills')
        await ctx.screenshot(page, '5-thirteenth-refused')
        await page.keyboard.press('Escape')
      } finally {
        await db('candidateprofiles', 'updateMany', {
          filter: { userId: { $oid: (await api('/me', { token })).body.id } },
          update: { $set: { skills: original.map((name) => ({ name, key: name.toLocaleLowerCase() })), learningPlan: [] } },
        })
      }

      // Job match: "Save this opportunity" uses the saved jobs (M-065); Why recommended stores feedback (M-067).
      const [role] = (await api('/candidate/insights/roles', { token })).body.items
      await api(`/candidate/saved-jobs/${role.id}`, { method: 'DELETE', token })
      await page.goto(`${ctx.webUrl}/candidate/ai-insights/job-match?jobId=${role.id}`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-save-job]', { visible: true })
      await page.click('[data-save-job]')
      await waitForText(page, 'Saved to your jobs')
      ctx.check((await api('/candidate/saved-jobs', { token })).body.items.some((job) => job.id === role.id), 'saved to the saved jobs')
      await page.waitForSelector('[data-narrative="job_match"] p:not([data-ai-state])', { visible: true, timeout: 60_000 })
      await ctx.screenshot(page, '6-job-match')
      await page.goto(`${ctx.webUrl}/candidate/ai-insights/why-recommended?jobId=${role.id}`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-narrative="why"] li', { visible: true, timeout: 60_000 })
      await page.click('[data-feedback="needs_review"]')
      // An earlier scenario may already have answered for this job, so wait for this answer to be the pressed one.
      await page.waitForSelector('[data-feedback="needs_review"][aria-pressed="true"]', { visible: true })
      await waitForText(page, 'Thanks, your answer is saved.')
      const [stored] = await db('explanationfeedbacks', 'find', { filter: { jobId: { $oid: role.id } } })
      ctx.check(stored?.value === 'needs_review', 'the feedback is stored')
      await ctx.screenshot(page, '7-why')
      await api(`/candidate/saved-jobs/${role.id}`, { method: 'DELETE', token })
      ctx.assertClean(handle.issues, 'insights pages')
    })

    // Free: the plan gate instead of the pages.
    const alex = await ctx.newPage()
    await openAs(ctx, alex, ctx.seedCredentials.email('alex'), '/candidate/ai-insights', ctx.seedCredentials.password)
    await waitForText(alex.page, 'Plus')
    ctx.check(!(await alex.page.$('[data-narrative]')), 'no AI insights for Free')
    await ctx.screenshot(alex.page, '8-free-gate')
    ctx.assertClean(alex.issues, 'Free gate')
  },
}
