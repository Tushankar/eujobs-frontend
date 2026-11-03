import { existsSync, openAsBlob, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fixture } from '../fixtures/make.js'
import { chooseFile, clickText, signInWithForm } from '../lib/flows.js'
import { API_URL } from '../lib/env.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

const UPLOADS = 'C:/eujobs-data/uploads/_test'

/** A multipart upload streamed from disk (openAsBlob does not read the file into memory). */
async function uploadFromDisk(token, purpose, path, type) {
  const form = new FormData()
  form.append('file', await openAsBlob(path, { type }), basename(path))
  const response = await fetch(`${API_URL}/api/v1/admin/uploads?purpose=${purpose}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
  return { status: response.status, body: await response.json() }
}

/**
 * P8-02 (M-102, M-107, M-185): a 501 MB video, a 51 MB PDF and a 6 MB cover are refused, in the builder before
 * uploading and by the server with 413 FILE_TOO_LARGE (on localhost, C26). Nothing is kept on disk or recorded.
 */
export default {
  name: 'P8-02 Upload limits',
  viewports: ['D'],
  async run(ctx) {
    const token = await ownerToken()
    const course = (await api('/admin/courses', { method: 'POST', token, body: { audience: 'candidate', title: 'Upload limits check' } })).body
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/admin/sign-in', ctx.seedCredentials.email(), ctx.seedCredentials.password)
    await page.goto(`${ctx.webUrl}/admin/courses/${course.id}/edit`, { waitUntil: 'networkidle0' })

    await chooseFile(page, '[data-upload="course_cover"] input[type="file"]', fixture('photo-6mb.png'))
    await page.waitForSelector('[data-upload="course_cover"] [data-upload-error]', { visible: true })
    const coverError = await page.$eval('[data-upload="course_cover"] [data-upload-error]', (element) => element.innerText)
    ctx.check(/larger than 5 MB/.test(coverError), `the 6 MB cover is refused: ${coverError}`)
    await ctx.screenshot(page, '1-cover-too-large')

    await clickText(page, 'Lessons', 'main [role="tab"]')
    for (const [type, purpose, file] of [
      ['video', 'lesson_video', 'video-501mb.mp4'],
      ['document', 'lesson_document', 'worksheet-51mb.pdf'],
    ]) {
      await page.click('[data-add-lesson]')
      await page.waitForSelector('[role="dialog"] [data-lesson-form]', { visible: true })
      await page.select('[role="dialog"] select[name="type"]', type)
      await chooseFile(page, `[role="dialog"] [data-upload="${purpose}"] input[type="file"]`, fixture(file))
      await page.waitForSelector(`[role="dialog"] [data-upload="${purpose}"] [data-upload-error]`, { visible: true })
      const text = await page.$eval(`[role="dialog"] [data-upload="${purpose}"] [data-upload-error]`, (element) => element.innerText)
      ctx.check(/larger than 50{0,2} MB/.test(text), `${file} is refused in the builder: ${text}`)
      await ctx.screenshot(page, `2-${type}-too-large`)
      await clickText(page, 'Cancel', '[role="dialog"] button')
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    }
    ctx.assertClean(handle.issues, 'upload limits')

    // The server's own limits, without the browser's pre-check.
    for (const [purpose, file, type] of [
      ['lesson_video', 'video-501mb.mp4', 'video/mp4'],
      ['lesson_document', 'worksheet-51mb.pdf', 'application/pdf'],
      ['course_cover', 'photo-6mb.png', 'image/png'],
    ]) {
      const result = await uploadFromDisk(token, purpose, fixture(file), type)
      ctx.check(result.status === 413 && result.body.error.code === 'FILE_TOO_LARGE', `${file}: ${result.status} ${result.body.error?.code}`)
    }
    const kept = await db('files', 'find', { filter: { originalName: { $in: ['video-501mb.mp4', 'worksheet-51mb.pdf', 'photo-6mb.png'] } } })
    ctx.check(kept.length === 0, 'no refused file is recorded')
    const incoming = join(UPLOADS, '_incoming')
    ctx.check(!existsSync(incoming) || readdirSync(incoming).length === 0, 'the incoming folder holds no partial upload')
  },
}
