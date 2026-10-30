import { fixture } from '../fixtures/make.js'
import { chooseFile, clickText, pageApi, signInWithForm, waitForText } from '../lib/flows.js'
import { onboardedCandidate, uploadAs } from '../lib/candidates.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

const PDF = 'application/pdf'
const row = (number) => `article[data-version="${number}"]`

/**
 * P3-05 (M-027 … M-031, U18, U39, P3-D7): a text PDF becomes version 1, live; an image-only PDF shows "No readable
 * text"; a DOCX is accepted; 11 MB and a 21st version are refused; Download serves the file; a tampered signature
 * gets 403; the live version cannot be deleted and a non-live one can.
 */
export default {
  name: 'P3-05 CV',
  viewports: ['D'],
  async run(ctx) {
    const { email, token } = await onboardedCandidate('Cv')
    const handle = await ctx.newPage()
    handle.allow(422, '/api/v1/candidate/cv/versions')
    handle.allow(403, '/api/v1/files/')
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/sign-in', email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/candidate/cv-versions`, { waitUntil: 'networkidle0' })

    await chooseFile(page, 'input[type="file"]', fixture('cv-text.pdf'))
    await waitForText(page, 'was added as version 1 and is now your live CV.')
    ctx.check(await page.$eval(row(1), (element) => element.innerText.includes('Current live CV')), 'version 1 is live')
    await chooseFile(page, 'input[type="file"]', fixture('cv-scanned.pdf'))
    await page.waitForSelector(row(2))
    ctx.check(await page.$eval(row(2), (element) => element.innerText.includes('No readable text')), 'the image-only PDF has no readable text')
    await chooseFile(page, 'input[type="file"]', fixture('cv.docx'))
    await page.waitForSelector(row(3))
    ctx.check(await page.$eval(row(3), (element) => !element.innerText.includes('No readable text')), 'the DOCX text was read')
    await chooseFile(page, 'input[type="file"]', fixture('cv-11mb.pdf'))
    await waitForText(page, 'cv-11mb.pdf is larger than 10 MB.')
    await ctx.screenshot(page, '1-versions')

    // Up to 20 versions through the API, then the 21st in the page.
    for (let i = 4; i <= 20; i++) {
      const res = await uploadAs(token, '/candidate/cv/versions', fixture('cv-text.pdf'), PDF)
      if (res.status !== 201) throw new Error(`upload ${i} failed: ${res.status}`)
    }
    await page.reload({ waitUntil: 'networkidle0' })
    await chooseFile(page, 'input[type="file"]', fixture('cv-text.pdf'))
    await waitForText(page, 'You can keep up to 20 versions. Delete one first.')

    const download = page.waitForResponse((response) => response.url().includes('/api/v1/files/') && response.url().includes('download=1'))
    await page.click(`${row(3)} button[aria-label="Download version 3"]`)
    const served = await download
    ctx.check(served.status() === 200, `the download is served (${served.status()})`)
    ctx.check((served.headers()['content-disposition'] ?? '').startsWith('attachment'), 'as an attachment')

    const third = (await pageApi(page, '/candidate/cv')).body.items.find((item) => item.number === 3)
    const { url } = (await pageApi(page, `/candidate/cv/versions/${third.id}/download`)).body
    const tampered = url.replace(/sig=(.)/, (match, first) => `sig=${first === 'a' ? 'b' : 'a'}`)
    const status = await page.evaluate(async (target) => (await fetch(target)).status, tampered)
    ctx.check(status === 403, `a tampered signature gets 403 (got ${status})`)

    ctx.check(!(await page.$(`${row(20)} button[aria-label="Delete version 20"]`)), 'the live version has no Delete')
    await page.click(`${row(1)} button[aria-label="Delete version 1"]`)
    await clickText(page, 'Delete version', '[role="dialog"] button')
    await waitForText(page, 'Version 1 was deleted.')
    ctx.check(!(await page.$(row(1))), 'version 1 is gone')
    await ctx.screenshot(page, '2-after-delete')
    ctx.assertClean(handle.issues, 'cv page')
  },
}
