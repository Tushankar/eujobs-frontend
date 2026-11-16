import { completeCandidate } from '../lib/applicants.js'
import { clickText, responseTo, setValue, waitForText } from '../lib/flows.js'
import { resultsBy, tick } from '../lib/matching.js'
import { openAs } from '../lib/payments.js'
import { approvedRecruiter, jobBody, login, postJob } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

/**
 * P14-01 (worldwide, owner 2026-11-16): a Plus candidate living in Kolkata (a real Google place) and two London jobs,
 * one sponsoring a work visa. Without a UK right to work only the sponsoring job escapes the location cap; Find jobs
 * tags it and its "Offers visa sponsorship" filter keeps only it; AI insights › Job match reads "Visa sponsored" and
 * the AI explanation (real OpenAI) speaks of the sponsorship. Adding a UK visa through the profile's country picker
 * lifts the cap on the other job too. A visitor's /jobs?visa=1 lists the sponsoring job only, and a Kolkata clock
 * preselects India at sign-up.
 */
export default {
  name: 'P14-01 Worldwide visa sponsorship and right to work',
  viewports: ['D'],
  async run(ctx) {
    // 1. Two London jobs from one recruiter: one sponsors a visa.
    const recruiter = await approvedRecruiter('Visa')
    const recruiterToken = await login(recruiter.email)
    const sponsoring = await postJob(recruiterToken, jobBody({ title: 'Visa sponsored product designer', visaSponsorship: true }))
    const local = await postJob(recruiterToken, jobBody({ title: 'Local only product designer' }))
    ctx.check(sponsoring.visaSponsorship === true && local.visaSponsorship === false, 'jobs saved with and without sponsorship')

    // 2. A complete Plus candidate moves to Kolkata, with an Indian right to work only.
    const candidate = await completeCandidate('Kolkata')
    const found = (await api(`/places/autocomplete?input=Kolkata&sessionToken=${crypto.randomUUID()}`, { token: candidate.token })).body.items ?? []
    const kolkata = found.find((place) => /India/.test(place.secondary))
    ctx.check(Boolean(kolkata), `Google finds Kolkata, India (${found.map((place) => `${place.city} / ${place.secondary}`).join('; ')})`)
    const moved = await api('/candidate/profile', {
      method: 'PUT',
      token: candidate.token,
      body: {
        fullName: candidate.fullName,
        headline: 'Product Designer',
        placeId: kolkata.placeId,
        about: 'A product designer who builds calm, accessible tools for teams.',
        yearsExperience: 5,
        skills: ['Figma', 'Design Systems', 'Prototyping'],
        workPreference: 'hybrid',
        availability: 'available_now',
      },
    })
    ctx.check(moved.status === 200 && moved.body.location?.countryCode === 'IN', `the profile city is in India (${moved.status} ${moved.body.location?.city})`)
    const rights = await api('/candidate/profile/right-to-work', { method: 'PUT', token: candidate.token, body: { rightToWork: [{ region: 'IN', status: 'citizen_settled' }] } })
    ctx.check(rights.status === 200 && rights.body.rightToWork.map((entry) => entry.region).join() === 'IN', 'right to work: India only')

    // 3. Scores: the sponsoring job is not capped, the local-only one is.
    await tick()
    let results = await resultsBy({ candidateId: candidate.id })
    const sponsoredScore = results.get(sponsoring.id)
    const localScore = results.get(local.id)
    ctx.check(Boolean(sponsoredScore && localScore), 'both jobs are scored')
    ctx.check(sponsoredScore?.locationCapped === false, `sponsoring job not capped (score ${sponsoredScore?.score})`)
    ctx.check(localScore?.locationCapped === true && localScore.score <= 49, `local-only job capped at 49 (score ${localScore?.score})`)

    // 4. Find jobs: the tag and the filter (signed in through the real form).
    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, candidate.email, '/candidate/jobs')
    const sponsoringCard = `article[data-job="${sponsoring.id}"]`
    const localCard = `article[data-job="${local.id}"]`
    await page.waitForSelector(sponsoringCard)
    ctx.check(Boolean(await page.$(`${sponsoringCard} [data-visa-sponsorship]`)), 'the sponsoring card shows "Visa sponsorship"')
    ctx.check(!(await page.$(`${localCard} [data-visa-sponsorship]`)), 'the local-only card does not')
    await ctx.screenshot(page, '1-find-jobs-tag')
    await clickText(page, 'Filters', 'button')
    await page.waitForSelector('[role="dialog"]')
    const filtered = responseTo(page, ['/api/v1/jobs?', 'visaSponsorship=1'])
    await clickText(page, 'Offers visa sponsorship', '[role="dialog"] label')
    await filtered
    await clickText(page, 'Show', '[role="dialog"] button')
    await page.waitForFunction((selector) => !document.querySelector(selector), {}, localCard)
    ctx.check(Boolean(await page.$(sponsoringCard)), 'the visa filter keeps the sponsoring job and drops the local-only one')
    await ctx.screenshot(page, '2-visa-filter')

    // 5. Job details: the top fact.
    await page.goto(`${ctx.webUrl}/candidate/jobs/${sponsoring.id}`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Visa sponsorship available')
    ctx.check(Boolean(await page.$('[data-visa-sponsorship]')), 'details: "Visa sponsorship available" in the top facts')

    // 6. AI insights › Job match: "Visa sponsored", and the real AI explanation mentions the sponsorship.
    await page.goto(`${ctx.webUrl}/candidate/ai-insights/job-match?jobId=${sponsoring.id}`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'Visa sponsored')
    const row = await page.evaluate(() => [...document.querySelectorAll('tr, li, [role="row"]')].map((element) => element.innerText.replace(/\s+/g, ' ')).find((text) => /Right to work/.test(text)) ?? '')
    ctx.check(/Visa sponsored/.test(row) && /sponsors your visa/.test(row), `match row: ${row}`)
    const narrative = await api(`/candidate/insights/narrative?section=job_match&jobId=${sponsoring.id}`, { token: candidate.token })
    const aiText = JSON.stringify(narrative.body)
    console.log(`  AI explanation: ${aiText.slice(0, 600)}`)
    ctx.check(narrative.status === 200 && /sponsor/i.test(aiText), 'the AI explanation mentions the visa sponsorship')
    await ctx.screenshot(page, '3-job-match')

    // 7. A UK visa added through the profile's country picker lifts the cap on the local-only job.
    await page.goto(`${ctx.webUrl}/candidate/profile`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Edit right to work', 'button')
    await page.click('button[name="rightToWorkAdd"]')
    await page.keyboard.type('united kingdom')
    await page.keyboard.press('Enter')
    await page.waitForSelector('[name="status-GB"]')
    await page.select('[name="status-GB"]', 'visa_permit')
    await setValue(page, 'input[name="expires-GB"]', '2031-12-31')
    await ctx.screenshot(page, '4-uk-visa')
    const saved = responseTo(page, '/api/v1/candidate/profile/right-to-work', 'PUT')
    await clickText(page, 'Save', '[role="dialog"] button')
    await saved
    const profile = (await api('/candidate/profile', { token: candidate.token })).body
    ctx.check(profile.rightToWork.map((entry) => `${entry.region}:${entry.status}`).sort().join() === 'GB:visa_permit,IN:citizen_settled', `saved: ${profile.rightToWork.map((entry) => entry.region).join(', ')}`)
    await tick()
    results = await resultsBy({ candidateId: candidate.id })
    ctx.check(results.get(local.id)?.locationCapped === false, `with the UK visa the local-only job is no longer capped (score ${results.get(local.id)?.score})`)
    ctx.assertClean(handle.issues, 'candidate pages')

    // 8. A visitor: /jobs?visa=1 lists the sponsoring job only.
    const visitor = await ctx.newPage()
    await visitor.page.goto(`${ctx.webUrl}/jobs?visa=1`, { waitUntil: 'networkidle0' })
    await visitor.page.waitForSelector('[data-row]')
    const rows = await visitor.page.$$eval('[data-row]', (items) => items.map((item) => item.innerText))
    ctx.check(rows.some((text) => text.includes('Visa sponsored product designer')) && !rows.some((text) => text.includes('Local only product designer')), `public visa filter (${rows.length} rows)`)
    ctx.check((await visitor.page.$eval('button[aria-pressed]', (button) => button.getAttribute('aria-pressed'))) === 'true', 'the toggle shows as on')
    await ctx.screenshot(visitor.page, '5-public-visa')

    // 9. Sign-up from a Kolkata clock preselects India in the country picker.
    await visitor.page.emulateTimezone('Asia/Kolkata')
    await visitor.page.goto(`${ctx.webUrl}/sign-up`, { waitUntil: 'networkidle0' })
    await visitor.page.waitForSelector('button[name="country"]')
    ctx.check((await visitor.page.$eval('button[name="country"]', (button) => button.textContent.trim())) === 'India', 'sign-up preselects India')
    ctx.assertClean(visitor.issues, 'public pages')
  },
}
