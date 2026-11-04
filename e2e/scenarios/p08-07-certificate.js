import { getDocument } from '../../server/node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import { onboardedCandidate } from '../lib/candidates.js'
import { API_URL } from '../lib/env.js'
import { fill, signInWithForm } from '../lib/flows.js'
import { enrolFree, openLessons, passQuiz, publishedCourse } from '../lib/learning.js'
import { openAs } from '../lib/payments.js'
import { ownerToken } from '../lib/recruiters.js'
import { api } from '../lib/testApi.js'

const NAME = 'Łukasz Żółć'

/** The learner's certificate PDF (its signed link from the API) as text, with its raw bytes. */
async function certificatePdf(token) {
  const [certificate] = (await api('/learning/certificates', { token })).body.items
  const { url } = (await api(`/learning/certificates/${certificate.id}/pdf`, { token })).body
  const bytes = Buffer.from(await (await fetch(`${API_URL}${url}`)).arrayBuffer())
  const page = await (await getDocument({ data: new Uint8Array(bytes) }).promise).getPage(1)
  return { url, raw: bytes.toString('latin1'), text: (await page.getTextContent()).items.map((item) => item.str).join(' ') }
}

const checkPublic = (code, ip) => fetch(`${API_URL}/api/v1/public/certificates/${code}`, { headers: { 'X-Forwarded-For': ip } })

/**
 * P8-07 (M-105, U17, C18): "Łukasz Żółć" (French) gets a PDF with the diacritics, the course title as authored, the
 * date and chrome in French, the code and the QR code. Signed out, /certificates/:code says Valid with name, course and
 * date; the 31st check in a minute is rate-limited. A name change re-issues the PDF with the same code; the admin
 * revokes it and the page says Revoked.
 */
export default {
  name: 'P8-07 Certificate',
  viewports: ['D', 'M'],
  async run(ctx) {
    const owner = await ownerToken()
    const title = `Designing trusted fintech journeys (${ctx.viewport} ${Date.now() % 100000})`
    const course = await publishedCourse(owner, { title, isFree: true })
    const learner = await onboardedCandidate(`Certificate${ctx.viewport}`, { fullName: NAME })
    await api('/me', { method: 'PATCH', token: learner.token, body: { language: 'fr', languageExplicit: true } })
    await enrolFree(learner.token, course.id)
    await openLessons(learner.token, course)
    const { certificate } = await passQuiz(learner.token, owner, course.id)
    const { code } = certificate

    const pdf = await certificatePdf(learner.token)
    for (const expected of [NAME, title, 'CERTIFICAT DE RÉUSSITE', 'Délivré le', code]) ctx.check(pdf.text.includes(expected), `the PDF shows "${expected}"`)
    ctx.check(/\/FontFile2/.test(pdf.raw) && /Inter-Bold/.test(pdf.raw), 'the Inter fonts are embedded')
    // The browser part runs in the learner's French (the learning screens are translated since Phase 11).

    const handle = await ctx.newPage()
    const { page } = handle
    await openAs(ctx, handle, learner.email, `/candidate/learning/${course.id}`)
    await page.waitForSelector(`[data-certificate="${code}"]`, { visible: true })
    const download = page.waitForResponse((response) => response.url().includes('/api/v1/files/') && response.url().includes('download=1'))
    await page.click('[data-certificate-pdf]').catch(() => {})
    const response = await download
    ctx.check(response.status() === 200 && response.headers()['content-type'] === 'application/pdf', 'Download PDF serves the stored PDF')
    await ctx.screenshot(page, '1-course-certificate')
    const viewer = await ctx.newPage()
    await viewer.page.goto(`${API_URL}${pdf.url}`).catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await ctx.screenshot(viewer.page, '2-pdf')

    // Signed out: the public check.
    const visitor = await ctx.newPage()
    await visitor.page.goto(`${ctx.webUrl}/certificates/${code}`, { waitUntil: 'networkidle0' })
    await visitor.page.waitForSelector('[data-certificate-status="valid"]', { visible: true })
    const shown = await visitor.page.$eval('main', (main) => main.innerText)
    ctx.check(shown.includes(NAME) && shown.includes(title) && shown.includes('Valid'), 'signed out: Valid with name and course')
    await ctx.screenshot(visitor.page, '3-public-valid')

    // U17: 30 checks a minute per IP.
    const ip = `203.0.113.${ctx.viewport === 'D' ? 21 : 22}`
    const statuses = []
    for (let index = 0; index < 31; index++) statuses.push((await checkPublic(code, ip)).status)
    ctx.check(statuses.slice(0, 30).every((status) => status === 200) && statuses[30] === 429, `the 31st check in a minute is refused (${statuses.at(-1)})`)

    // U17: a name change re-issues the PDF under the same code.
    await api('/me', { method: 'PATCH', token: learner.token, body: { fullName: `${NAME}-Nowak` } })
    const reissued = await certificatePdf(learner.token)
    ctx.check(reissued.text.includes(`${NAME}-Nowak`) && reissued.text.includes(code), 'the re-issued PDF has the new name and the same code')

    // The admin revokes it from the learners list (audited); the public page says Revoked.
    const admin = await ctx.newPage()
    await signInWithForm(admin.page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await admin.page.goto(`${ctx.webUrl}/admin/courses/${course.id}/learners`, { waitUntil: 'networkidle0' })
    await admin.page.click(`[data-revoke="${code}"]`)
    await fill(admin.page, '[role="dialog"] textarea[name="reason"]', 'The quiz answers were shared.')
    await admin.page.click('[data-confirm-revoke]')
    await admin.page.waitForFunction((value) => document.querySelector(`[data-learner-certificate="${value}"]`)?.innerText.includes('Revoked'), {}, code)
    await ctx.screenshot(admin.page, '4-revoked')
    await visitor.page.reload({ waitUntil: 'networkidle0' })
    await visitor.page.waitForSelector('[data-certificate-status="revoked"]', { visible: true })
    await ctx.screenshot(visitor.page, '5-public-revoked')
    ctx.assertClean(handle.issues, 'learner')
    ctx.assertClean(visitor.issues, 'public page')
    ctx.assertClean(admin.issues, 'admin')
  },
}
