import { approvedAgency, dayFromToday, publishAgreement, submittedAgency } from '../lib/agencies.js'
import { openAsAdmin, sidebarLabels } from '../lib/admins.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { bodyText, chooseFile, clickText, fill, signInWithForm, waitForPath, waitForSettled, waitForText } from '../lib/flows.js'
import { fixture } from '../fixtures/make.js'
import { jobBody, postJob } from '../lib/recruiters.js'
import { api, date, db, mailTo, TEST_PASSWORD, uniqueEmail } from '../lib/testApi.js'

/**
 * P15-01 (agencies, phase 4): the public /agencies page and the agency sign-up; an approved agency's workspace
 * (Clients, Talent with the agreement, an agency job's terms and contract card, a request accepted and agreed, the
 * bell, a hire that makes a placement); and the admin's Agencies tabs. Desktop and phone, and the agreement in dark.
 */
export default {
  name: 'P15-01 Agency workspace',
  viewports: ['D', 'M'],
  async run(ctx) {
    const phone = ctx.viewport === 'M'
    const handle = await ctx.newPage()
    const { page } = handle
    handle.allow(422, '/api/v1/agency/agreement/draft/rules')

    // 1. A visitor: what agencies get and the Agency plans.
    await page.goto(`${ctx.webUrl}/agencies`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-plan="agency_plus"]')
    ctx.check((await bodyText(page)).includes('Place people with your clients'), '/agencies shows its heading')
    ctx.check(Boolean(await page.$('[data-plan="agency_free"]')), 'the Agency Free plan card shows')
    await handle.checkOverflow()
    await ctx.screenshot(page, '1-agencies-page')

    // 2. Sign up as an agency: the person's own role is labelled clearly; the code opens agency onboarding.
    if (!phone) {
      await clickText(page, 'Sign up as an agency', 'a')
      await waitForPath(page, '/agencies/signup')
      await page.waitForFunction(() => document.querySelector('select[name="country"]')?.value)
      ctx.check((await bodyText(page)).includes('Your role at the agency'), 'sign-up asks "Your role at the agency"')
      const email = uniqueEmail('p1501')
      await fill(page, 'input[name="fullName"]', 'Ada Agent')
      await fill(page, 'input[name="jobTitle"]', 'Agency director')
      await fill(page, 'input[name="email"]', email)
      await page.select('select[name="country"]', 'GB')
      await fill(page, 'input[name="phone"]', '020 7946 0958')
      await fill(page, 'input[name="password"]', TEST_PASSWORD)
      await fill(page, 'input[name="confirmPassword"]', TEST_PASSWORD)
      await page.$eval('input[name="acceptTerms"]', (box) => box.click())
      await ctx.screenshot(page, '2-agency-sign-up')
      await page.click('button[type="submit"]')
      await waitForPath(page, '/agency/onboarding/email-code')
      const { code } = (await mailTo(email, 'recruiter_email_code')).at(-1).params
      await page.type('input[name="code"]', code)
      await page.click('button[type="submit"]')
      await waitForPath(page, () => location.pathname.startsWith('/agency/onboarding/') && !location.pathname.endsWith('email-code'))
      await waitForSettled(page)
      ctx.check((await bodyText(page)).includes('Your role at the agency'), 'onboarding step 1 says "Your role at the agency"')
      await ctx.screenshot(page, '3-agency-onboarding')
      await page.evaluate(() => localStorage.clear())
    }

    // 3. An approved agency signs in at /agencies/login and lands in /agency.
    const agency = await approvedAgency('P1501')
    await signInWithForm(page, ctx.webUrl, '/agencies/login', agency.email, TEST_PASSWORD)
    await waitForPath(page, '/agency')
    const labels = await sidebarLabels(page)
    ctx.check(['Clients', 'Talent', 'Placements', 'Agency page'].every((label) => labels.includes(label)), `agency nav (${labels.join(', ')})`)
    await ctx.screenshot(page, '4-agency-overview')

    // 4. Clients: the get-started card, then a client added in the dialog.
    await page.goto(`${ctx.webUrl}/agency/clients`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Add the companies you recruit for')
    await page.click('[data-add-client]')
    await page.waitForSelector('#client-form')
    await fill(page, '#client-form input[name="name"]', 'Acme Logistics')
    await fill(page, '#client-form input[name="industry"]', 'Logistics')
    await page.click('button[form="client-form"]')
    await page.waitForSelector('[data-client="Acme Logistics"]')
    await handle.checkOverflow()
    await ctx.screenshot(page, '5-clients')

    // 5. Talent › Agreement: upload, a clause not in the PDF is refused, the quoted one is saved, version 1 published.
    await page.goto(`${ctx.webUrl}/agency/talent?tab=agreement`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Upload the agreement candidates sign')
    await chooseFile(page, 'input[type="file"]', fixture('agency-agreement.pdf'))
    await page.waitForSelector('[data-agreement-draft]')
    await fill(page, 'input[name="noticeDays.value"]', '7')
    await fill(page, 'textarea[name="noticeDays.clause"]', 'Notice is one week.')
    await page.click('[data-rules-action="save"]')
    await waitForText(page, 'not in the PDF word for word')
    ctx.check(true, 'a clause that is not in the PDF is refused')
    await fill(page, 'textarea[name="noticeDays.clause"]', 'Either party may end an Assignment by giving seven days of written notice.')
    await page.click('[data-rules-action="publish"]')
    await page.waitForSelector('[data-agreement-current]')
    const agreementText = await bodyText(page)
    ctx.check(agreementText.includes('Version 1') && agreementText.includes('7 days'), 'version 1 is current with a 7-day notice')
    await handle.checkOverflow()
    await ctx.screenshot(page, '6-agreement')
    if (!phone) {
      await page.evaluate(() => localStorage.setItem('lwm-pref-theme', 'dark'))
      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-agreement-current]')
      await ctx.screenshot(page, '6b-agreement-dark')
      await page.evaluate(() => localStorage.setItem('lwm-pref-theme', 'light'))
    }

    // 6. An agency job for the client: its terms on the job page, the contract card in the wizard's agency step.
    const clients = (await api('/agency/clients', { token: agency.token })).body.items
    const job = await postJob(agency.token, jobBody({ title: 'Warehouse Operative', agency: { clientId: clients[0].id, showClient: false, startDate: dayFromToday(3), endDate: dayFromToday(33), rate: { amountMinor: 1450, period: 'hour' } } }))
    await page.goto(`${ctx.webUrl}/agency/jobs/${job.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-agency-terms]')
    const terms = await page.$eval('[data-agency-terms]', (card) => card.innerText)
    ctx.check(terms.includes('Acme Logistics') && terms.includes('Confidential client'), 'job page: the client, shown as confidential')
    await ctx.screenshot(page, '7-job-terms')
    await clickText(page, 'Edit', '[data-agency-terms] a')
    await page.waitForSelector('[data-contract-card]')
    ctx.check((await bodyText(page)).includes('Agency terms') || (await bodyText(page)).includes('Client'), 'the wizard opens the agency step')
    await handle.checkOverflow()
    await ctx.screenshot(page, '8-wizard-agency-step')

    // 7. A candidate asks to join: accepted in Talent › Requests, then agrees; the bell says so.
    const candidate = await onboardedCandidate('P1501')
    const me = (await api('/me', { token: candidate.token })).body
    const company = (await api('/me', { token: agency.token })).body.company
    const joined = (await api(`/candidate/agencies/${company.id}/join`, { method: 'POST', token: candidate.token })).body
    await page.goto(`${ctx.webUrl}/agency/talent?tab=requests`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-member="${me.fullName}"]`)
    await clickText(page, 'Accept', `[data-member="${me.fullName}"] button`)
    await waitForText(page, 'Waiting for them to agree')
    await ctx.screenshot(page, '9-requests')
    await api(`/candidate/agencies/memberships/${joined.id}/agree`, { method: 'POST', token: candidate.token, body: { version: 1 } })
    await page.goto(`${ctx.webUrl}/agency/talent`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Agreed to version 1')
    await handle.checkOverflow()
    await ctx.screenshot(page, '10-on-the-books')
    await page.goto(`${ctx.webUrl}/agency/notifications`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'asked to join your books')
    ctx.check((await bodyText(page)).includes('agreed to version 1 of your agreement'), 'the bell has the request and the agreement')

    // 8. Hired on the agency job: an upcoming placement with its rules and where each comes from.
    const companyId = { $oid: company.id }
    const [entry] = await db('pipelinestages', 'find', { filter: { companyId, isEntry: true } })
    const [hired] = await db('pipelinestages', 'find', { filter: { companyId, category: 'hired' } })
    const now = date(Date.now())
    await db('applications', 'insertOne', {
      doc: { candidateId: { $oid: me.id }, jobId: { $oid: job.id }, companyId, stageId: entry._id, status: 'applied', consentAt: now, appliedAt: now, history: [{ status: 'applied', at: now, actorType: 'candidate' }], createdAt: now, updatedAt: now },
    })
    const [application] = await db('applications', 'find', { filter: { candidateId: { $oid: me.id }, jobId: { $oid: job.id } } })
    const moved = await api(`/recruiter/applications/${application._id.$oid ?? application._id}/stage`, { method: 'PATCH', token: agency.token, body: { stageId: hired._id.$oid ?? hired._id } })
    ctx.check(moved.status === 200, `moved to Hired (${moved.status})`)
    await page.goto(`${ctx.webUrl}/agency/placements?tab=upcoming`, { waitUntil: 'networkidle0' })
    await page.waitForSelector(`[data-placement="${me.fullName}"]`)
    await clickText(page, me.fullName, `[data-placement="${me.fullName}"] button`)
    await waitForText(page, 'Rules of this placement')
    const details = await bodyText(page)
    ctx.check(details.includes('From the agency agreement') && details.includes('Default rule'), 'rules name their source')
    await ctx.screenshot(page, '11-placement')

    // 9. The admin: Moderation › Accounts › Agencies and Admin › Agencies.
    if (!phone) {
      const waiting = await submittedAgency('P1501W')
      const admin = await ctx.newPage()
      await openAsAdmin(ctx, admin, ctx.seedCredentials.email(null), '/admin/moderation/accounts?kind=agency', ctx.seedCredentials.password)
      await waitForText(admin.page, waiting.fullName)
      ctx.check((await bodyText(admin.page)).includes('Agency'), 'the agency queue shows the Agency badge')
      await ctx.screenshot(admin.page, '12-admin-accounts-agencies')
      await admin.page.goto(`${ctx.webUrl}/admin/agencies`, { waitUntil: 'networkidle0' })
      await waitForText(admin.page, agency.email)
      await ctx.screenshot(admin.page, '13-admin-agencies')
    }
  },
}
