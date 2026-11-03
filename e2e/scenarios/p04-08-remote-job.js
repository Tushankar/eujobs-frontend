import { onboardedCandidate } from '../lib/candidates.js'
import { clickText, signInWithForm, waitForText } from '../lib/flows.js'
import { approvedRecruiter, jobBody, login, postJob } from '../lib/recruiters.js'
import { api, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P4-08 (OD2, OQ-6i, M-131): a remote job eligible in Poland and Germany has country Remote and EUR. It lists only in
 * the candidate's Remote view with the "Eligible in" badge; the "Eligible in" filter keeps it for Poland and drops it
 * for France; the Poland view does not list it.
 */
export default {
  name: 'P4-08 Remote job',
  viewports: ['D'],
  async run(ctx) {
    const recruiter = await approvedRecruiter('Remote')
    const job = await postJob(await login(recruiter.email), jobBody({ title: 'Remote eligibility designer', workPreference: 'remote', placeId: null, remoteCountries: ['PL', 'DE'] }))
    ctx.check(job.country === 'REMOTE' && job.salary.currency === 'EUR', 'country Remote and EUR')

    const candidate = await onboardedCandidate('Remote')
    await api('/me', { method: 'PATCH', token: candidate.token, body: { pickerCountry: 'REMOTE' } })
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', candidate.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/jobs`, { waitUntil: 'networkidle0' })
    const card = `article[data-job="${job.id}"]`
    await page.waitForSelector(card)
    const text = await page.$eval(card, (element) => element.innerText)
    ctx.check(text.includes('Eligible in Poland and Germany'), `the eligible badge (got ${text})`)
    ctx.check(text.includes('€'), 'the salary is in EUR')
    await ctx.screenshot(page, '1-remote-view')

    const filterBy = async (code) => {
      await clickText(page, 'Filters', 'button')
      await page.waitForSelector('select[name="eligible"]')
      const counted = responseTo(page, ['/api/v1/jobs?', `eligible=${code}`])
      await page.select('select[name="eligible"]', code)
      await counted
      await clickText(page, 'Show', '[role="dialog"] button')
    }
    await filterBy('PL')
    await page.waitForSelector(card)
    await ctx.screenshot(page, '2-eligible-poland')
    await filterBy('FR')
    await page.waitForFunction((selector) => !document.querySelector(selector), {}, card)

    await api('/me', { method: 'PATCH', token: candidate.token, body: { pickerCountry: 'PL' } })
    const poland = await api('/jobs', { token: candidate.token })
    ctx.check(!poland.body.items.some((item) => item.id === job.id), 'the Poland view does not list it')
    await page.reload({ waitUntil: 'networkidle0' })
    await waitForText(page, 'Jobs in Poland')
    ctx.check(!(await page.$(card)), 'not on the Poland page either')
    ctx.assertClean(handle.issues, 'remote view')
  },
}
