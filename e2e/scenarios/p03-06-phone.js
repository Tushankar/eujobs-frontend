import { clickText, fill, signInWithForm, waitForText } from '../lib/flows.js'
import { onboardedCandidate } from '../lib/candidates.js'
import { api, db, TEST_PASSWORD } from '../lib/testApi.js'

const wrong = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, '0')
const shownCode = (page) =>
  page.$$eval('[role="status"]', (statuses) => statuses.map((status) => status.innerText.match(/Your code is (\d{6})/)?.[1]).find(Boolean))

/**
 * P3-06 (M-003, M-004, OD3): a Polish national number is normalised to E.164; the code shows on screen; 5 wrong
 * codes lock it; a new code waits 60 s; the right code verifies; the same number verifies on a second account.
 */
export default {
  name: 'P3-06 Phone',
  viewports: ['D', 'M'],
  async run(ctx) {
    const { email } = await onboardedCandidate('Phone')
    const handle = await ctx.newPage()
    handle.allow(422, '/api/v1/candidate/verification/phone/confirm')
    handle.allow(429, '/api/v1/candidate/verification/phone')
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/verification`, { waitUntil: 'networkidle0' })

    await page.select('select[name="phoneCountry"]', 'PL')
    await fill(page, 'input[name="phone"]', '512 345 678')
    await clickText(page, 'Send code', 'button')
    await waitForText(page, 'Your code is')
    const code = await shownCode(page)
    ctx.check((await page.$eval('input[name="phone"]', (input) => input.value)) === '+48512345678', 'the number is shown in E.164')
    const resend = await page.$$eval('button', (buttons) => buttons.map((button) => [button.innerText, button.disabled]).find(([text]) => text.startsWith('Send a new code in')))
    ctx.check(resend && resend[1], `a new code waits 60 s (${JSON.stringify(resend)})`)
    await ctx.screenshot(page, '1-code-shown')

    for (let attempt = 1; attempt <= 5; attempt++) {
      await fill(page, 'input[name="phoneCode"]', wrong(code))
      await clickText(page, 'Confirm', 'button')
      await waitForText(page, attempt < 5 ? `${5 - attempt} attempt` : 'Too many wrong attempts. Send a new code.')
    }
    await ctx.screenshot(page, '2-locked')

    // Let 60 s pass for the server, then reload so the page's own countdown restarts.
    const [user] = await db('users', 'find', { filter: { email } })
    await db('verificationcodes', 'updateMany', { filter: { userId: user._id }, update: { $set: { sentAt: { $date: new Date(Date.now() - 61_000).toISOString() } } } })
    await page.reload({ waitUntil: 'networkidle0' })
    await clickText(page, 'Send code', 'button')
    await waitForText(page, 'Your code is')
    await fill(page, 'input[name="phoneCode"]', await shownCode(page))
    await clickText(page, 'Confirm', 'button')
    await waitForText(page, '+48512345678 is verified.')
    await handle.checkOverflow()
    await ctx.screenshot(page, '3-verified')
    ctx.assertClean(handle.issues, 'phone')

    const second = await onboardedCandidate('PhoneTwo')
    const requested = await api('/candidate/verification/phone/code', { method: 'POST', token: second.token, body: { phone: '512 345 678', country: 'PL' } })
    const confirmed = await api('/candidate/verification/phone/confirm', { method: 'POST', token: second.token, body: { code: requested.body.code } })
    ctx.check(confirmed.body.phone?.verified && confirmed.body.phone.e164 === '+48512345678', 'the same number verifies on a second account (OD3)')
  },
}
