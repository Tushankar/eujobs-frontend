import { fixture } from '../fixtures/make.js'
import { recruiterWithJob } from '../lib/applicants.js'
import { invitedAdmin, openAsAdmin, roleWith } from '../lib/admins.js'
import { uploadAs } from '../lib/candidates.js'
import { checkLayout, findLeftovers, textsFor } from '../lib/i18nChecks.js'
import { clickNotification, openBell, rowsOf, waitForBell, waitForSection } from '../lib/notifications.js'
import { freeCandidate, openAs } from '../lib/payments.js'
import { ownerToken } from '../lib/recruiters.js'
import { api, db } from '../lib/testApi.js'

/** No English left and a clean long-text layout in `root` (the open dropdown, or the page). */
async function checkTranslated(ctx, page, language, root, label) {
  const texts = textsFor(language)
  const leftovers = await findLeftovers(page, texts)
  ctx.check(!leftovers.length, `${label}: ${leftovers.join('; ')}`)
  const { problems } = await checkLayout(page, { ...texts, language }, root)
  ctx.check(!problems.length, `${label} layout:\n  ${problems.join('\n  ')}`)
}

/**
 * P11b-04 (P11b rule: text rendered in the reader's current language): a Spanish candidate gets two verification
 * decisions; a French moderator gets one grouped notification for two reports of the same job. Both read their
 * dropdown and Notifications page in their language with no English left and a clean layout, open the item, and the
 * counts clear. The French Admin Settings shows the switches in French.
 */
export default {
  name: 'P11b-04 Notifications in es and fr',
  viewports: ['D', 'M'],
  async run(ctx) {
    // Spanish candidate: a check approved and one rejected (always-on decisions).
    const candidate = await freeCandidate(`Idioma${ctx.viewport}`, 'ES')
    await api('/me', { method: 'PATCH', token: candidate.token, body: { language: 'es', languageExplicit: true } })
    const owner = await ownerToken()
    await uploadAs(candidate.token, '/candidate/verification/submissions', fixture('passport.jpg'), 'image/jpeg', { category: 'identity', evidenceType: 'passport' })
    const [submission] = await db('verificationsubmissions', 'find', { filter: { userId: { $oid: candidate.user.id } } })
    await api(`/admin/moderation/verification/${submission._id.$oid}/decision`, { method: 'POST', token: owner, body: { decision: 'rejected', reason: 'La foto no se lee bien.' } })
    await uploadAs(candidate.token, '/candidate/verification/submissions', fixture('passport.jpg'), 'image/jpeg', { category: 'identity', evidenceType: 'passport' })
    const latest = (await db('verificationsubmissions', 'find', { filter: { userId: { $oid: candidate.user.id }, status: 'in_review' } }))[0]
    await api(`/admin/moderation/verification/${latest._id.$oid}/decision`, { method: 'POST', token: owner, body: { decision: 'approved' } })

    const es = await ctx.newPage()
    await openAs(ctx, es, candidate.email, '/candidate')
    await waitForBell(es.page, 2)
    await waitForSection(es.page, 'verification', 2)
    ctx.check((await es.page.$eval('[data-bell]', (bell) => bell.getAttribute('aria-label'))) === 'Notificaciones, 2 sin leer', 'Spanish bell label')
    await openBell(es.page)
    const rows = await rowsOf(es.page)
    ctx.check(rows[0].text.includes('Verificación aprobada: Identidad') && rows[1].text.includes('Verificación no aprobada: Identidad'), `es rows ${JSON.stringify(rows)}`)
    await checkTranslated(ctx, es.page, 'es', '[data-notifications-panel]', 'es dropdown')
    await es.checkOverflow()
    await ctx.screenshot(es.page, '1-es-dropdown')
    await clickNotification(es.page, 'verification_decided', '/candidate/verification')
    await waitForBell(es.page, 0)
    await waitForSection(es.page, 'verification', 0)
    await es.page.goto(`${ctx.webUrl}/candidate/notifications`, { waitUntil: 'networkidle0' })
    await new Promise((resolve) => setTimeout(resolve, 450))
    await checkTranslated(ctx, es.page, 'es', 'main', 'es page')
    await es.checkOverflow()
    await ctx.screenshot(es.page, '2-es-page')
    ctx.assertClean(es.issues, 'es candidate')

    // French moderator: two reports of one job collapse into one unread notification with the count.
    const moderator = await invitedAdmin(`Moderateur${ctx.viewport}`, (await roleWith(`Moderation fr ${ctx.viewport}`, ['moderation.manage', 'documents.view'])).id)
    await api('/me', { method: 'PATCH', token: moderator.token, body: { language: 'fr', languageExplicit: true } })
    const { job } = await recruiterWithJob(`Signal${ctx.viewport}`)
    for (const reason of ['spam', 'misleading']) {
      const reporter = await freeCandidate(`Reporter${reason}${ctx.viewport}`, 'GB')
      await api('/reports', { method: 'POST', token: reporter.token, body: { targetType: 'job', targetId: job.id, reason, details: '' } })
    }
    const fr = await ctx.newPage()
    await openAsAdmin(ctx, fr, moderator.email, '/admin/moderation')
    await waitForBell(fr.page, 1)
    await openBell(fr.page)
    const [report] = await rowsOf(fr.page)
    ctx.check(report.type === 'admin_content_report' && report.text.includes('2 signalements (Offre)') && report.text.includes('Trompeur'), `fr row ${JSON.stringify(report)}`)
    await checkTranslated(ctx, fr.page, 'fr', '[data-notifications-panel]', 'fr dropdown')
    await fr.checkOverflow()
    await ctx.screenshot(fr.page, '3-fr-dropdown')
    await clickNotification(fr.page, 'admin_content_report', '/admin/moderation/content/')
    await fr.page.waitForSelector('[role="dialog"]', { visible: true })
    await waitForBell(fr.page, 0)
    await fr.page.goto(`${ctx.webUrl}/admin/settings`, { waitUntil: 'networkidle0' })
    await fr.page.$eval('[data-card="notifications"]', (card) => card.scrollIntoView({ block: 'center' }))
    await new Promise((resolve) => setTimeout(resolve, 450))
    const labels = await fr.page.$$eval('[data-email-switches] [role="switch"]', (items) => items.map((item) => item.getAttribute('aria-label')))
    ctx.check(labels.includes('Signalements de contenu'), `fr switches ${labels}`)
    await checkTranslated(ctx, fr.page, 'fr', '[data-card="notifications"]', 'fr settings')
    await fr.checkOverflow()
    await ctx.screenshot(fr.page, '4-fr-settings')
    ctx.assertClean(fr.issues, 'fr admin')
  },
}
