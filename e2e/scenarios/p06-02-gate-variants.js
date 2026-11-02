import { applyApi, clickApply, completeCandidate } from '../lib/applicants.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { openAs, subscribeThroughApi, waitForPlan } from '../lib/payments.js'
import { api } from '../lib/testApi.js'

/** Opens a job page as the candidate, clicks Apply and returns what the gate shows. */
async function gateOf(ctx, candidate, jobId, name) {
  const handle = await ctx.newPage()
  const { page } = handle
  await openAs(ctx, handle, candidate.email, `/candidate/jobs/${jobId}`)
  await clickApply(page)
  await page.waitForSelector('[data-apply-gate]', { visible: true })
  const gate = {
    missing: await page.$$eval('[data-missing-item]', (items) => items.map((item) => item.dataset.missingItem)),
    plan: Boolean(await page.$('[data-plan-required]')),
    upgrade: await page.$$eval('[role="dialog"] button', (items) => items.some((item) => item.textContent.includes('Upgrade to apply'))),
  }
  await ctx.screenshot(page, name)
  ctx.assertClean(handle.issues, name)
  return gate
}

/**
 * P6-02 (§3.4): Plus but incomplete → only the missing items; Free but complete → only the upgrade. Direct API calls
 * answer 402 PLAN_REQUIRED and 403 PROFILE_INCOMPLETE with `missing`.
 */
export default {
  name: 'P6-02 Gate variants',
  viewports: ['D'],
  async run(ctx) {
    const plusIncomplete = await onboardedCandidate('GatePlus')
    const me = (await api('/me', { token: plusIncomplete.token })).body
    await subscribeThroughApi({ ...me, email: plusIncomplete.email })
    await waitForPlan(plusIncomplete.token, 'plus')
    const freeComplete = await completeCandidate('GateFree', { plus: false })
    const [job] = (await api('/jobs', { token: freeComplete.token })).body.items

    const plusGate = await gateOf(ctx, plusIncomplete, job.id, '1-plus-incomplete')
    const expected = me.completeness.items.filter((item) => !item.done).map((item) => item.key)
    ctx.check(JSON.stringify(plusGate.missing) === JSON.stringify(expected) && !plusGate.plan && !plusGate.upgrade, `Plus but incomplete: only the missing items (${JSON.stringify(plusGate)})`)
    const freeGate = await gateOf(ctx, freeComplete, job.id, '2-free-complete')
    ctx.check(freeGate.missing.length === 0 && freeGate.plan && freeGate.upgrade, `Free but complete: only the upgrade (${JSON.stringify(freeGate)})`)

    const free = await applyApi(freeComplete.token, job.id)
    ctx.check(free.status === 402 && free.body.error.code === 'PLAN_REQUIRED' && free.body.error.params.entitlement === 'apply', `API: Free → 402 (${free.status} ${free.body.error?.code})`)
    const incomplete = await applyApi(plusIncomplete.token, job.id)
    ctx.check(
      incomplete.status === 403 && incomplete.body.error.code === 'PROFILE_INCOMPLETE' && JSON.stringify(incomplete.body.error.params.missing) === JSON.stringify(expected),
      `API: incomplete → 403 with missing (${incomplete.status} ${JSON.stringify(incomplete.body.error)})`,
    )
  },
}
