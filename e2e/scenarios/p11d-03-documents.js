import { fixture } from '../fixtures/make.js'
import { seedCredentials } from '../lib/env.js'
import { chooseFile, responseTo, signInWithForm } from '../lib/flows.js'
import { EMMA, SARAH, seededPair } from '../lib/interviews.js'
import { notificationsOf } from '../lib/notifications.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, db, mailTo } from '../lib/testApi.js'

/** The signed file URLs a card shows to this page's reader, opened as the browser would (each opening is logged). */
const openFiles = (page, card) =>
  page.$$eval(`${card} [data-document-file]`, (links) => Promise.all(links.map((link) => fetch(link.href).then((response) => response.status))))

/**
 * P11d-03 (§3.23, P11d-Q7, Q19 … Q21): Sarah requests an ID and the signed offer with an offer letter attached; Emma
 * gets the bell and the email, opens the attachment, is refused a DOCX and an 11 MB PDF, uploads a PDF and a PNG; Sarah
 * gets a bell per answer and the "documents received" email, opens both files (each opening logged) and marks the
 * request complete.
 */
export default {
  name: 'P11d-03 Document request',
  viewports: ['D', 'M'],
  async run(ctx) {
    const pair = await seededPair()
    const recruiter = await ctx.newPage()
    const candidate = await ctx.newPage()
    await signInWithForm(recruiter.page, ctx.webUrl, '/recruiter/sign-in', SARAH(), seedCredentials.password)
    await signInWithForm(candidate.page, ctx.webUrl, '/sign-in', EMMA(), seedCredentials.password)

    const sarah = recruiter.page
    await sarah.goto(`${ctx.webUrl}/recruiter/messages/${pair.threadId}`, { waitUntil: 'networkidle0' })
    await sarah.click('[data-request-documents]')
    await sarah.click('label:has([data-document-kind="id"])')
    await sarah.click('label:has([data-document-kind="signed_offer"])')
    await chooseFile(sarah, '[data-request-attachment]', fixture('worksheet.pdf'))
    await recruiter.checkOverflow()
    await ctx.screenshot(sarah, '1-request-dialog')
    const sent = responseTo(sarah, '/api/v1/document-requests', 'POST')
    await sarah.click('[data-request-submit]')
    const request = await (await sent).json()
    ctx.check(request.items.length === 2 && request.attachment?.name === 'worksheet.pdf', `request ${JSON.stringify(request).slice(0, 160)}`)
    const card = `[data-document-request="${request.id}"]`
    ctx.check((await mailTo(EMMA(), 'document_request')).length === 1, 'Emma got the email')
    ctx.check((await notificationsOf(pair.emma)).items.some((item) => item.type === 'document_requested'), 'Emma got the bell')

    const emma = candidate.page
    await emma.goto(`${ctx.webUrl}/candidate/messages/${pair.threadId}`, { waitUntil: 'networkidle0' })
    await emma.waitForSelector(card)
    ctx.check((await openFiles(emma, card)).every((status) => status === 200), 'Emma opens the attachment')
    const [idItem, offerItem] = request.items
    await chooseFile(emma, `${card} [data-document-input="${idItem.id}"]`, fixture('cv.docx'))
    await emma.waitForSelector(`${card} [data-document-error]`)
    await chooseFile(emma, `${card} [data-document-input="${idItem.id}"]`, fixture('cv-11mb.pdf'))
    await emma.waitForSelector(`${card} [data-document-error]`)
    for (const [item, file] of [[idItem, 'evidence.pdf'], [offerItem, 'photo.png']]) {
      const uploaded = responseTo(emma, `/document-requests/${request.id}/items/${item.id}`, 'POST')
      await chooseFile(emma, `${card} [data-document-input="${item.id}"]`, fixture(file))
      ctx.check((await uploaded).status() === 200, `${file} is accepted`)
    }
    await emma.waitForFunction((selector) => document.querySelectorAll(`${selector} [data-document-file]`).length === 3, {}, card)
    await candidate.checkOverflow()
    await ctx.screenshot(emma, '2-candidate-uploaded')

    const types = (await notificationsOf(pair.sarah)).items.filter((item) => item.path.endsWith(request.id)).map((item) => item.type)
    ctx.check(types.includes('document_answered') && types.includes('documents_received'), `Sarah's bells (${types})`)
    ctx.check((await mailTo(SARAH(), 'documents_received')).length === 1, 'Sarah got the "documents received" email')
    await sarah.reload({ waitUntil: 'networkidle0' })
    await sarah.waitForSelector(card)
    ctx.check((await openFiles(sarah, card)).every((status) => status === 200), 'Sarah opens the files')
    const fileIds = (await db('documentrequests', 'find', { filter: { _id: { $oid: request.id } } }))[0].items.map((item) => item.fileId)
    for (const fileId of fileIds) ctx.check((await db('fileaccesslogs', 'count', { filter: { fileId } })) >= 1, 'each opening is logged')
    const completed = responseTo(sarah, `/document-requests/${request.id}/complete`, 'POST')
    await sarah.click(`${card} [data-complete-request]`)
    await completed
    await sarah.waitForSelector(`${card}[data-request-status="complete"]`)
    await recruiter.checkOverflow()
    await ctx.screenshot(sarah, '3-recruiter-complete')
    ctx.check((await api(`/document-requests/${request.id}`, { token: await ownerToken() })).status === 403, 'an admin is refused')
    ctx.assertClean([...recruiter.issues, ...candidate.issues], 'documents')
  },
}
