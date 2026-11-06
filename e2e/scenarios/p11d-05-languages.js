import { seedCredentials } from '../lib/env.js'
import { signInWithForm } from '../lib/flows.js'
import { checkLayout, findLeftovers, textsFor } from '../lib/i18nChecks.js'
import { bookedNow, EMMA, offerApi, SARAH, seededPair } from '../lib/interviews.js'
import { api, date, db } from '../lib/testApi.js'

/** No English left and a clean long-text layout in `root`. */
async function checkTranslated(ctx, page, language, root, label) {
  const texts = textsFor(language)
  const leftovers = await findLeftovers(page, texts)
  ctx.check(!leftovers.length, `${label}: ${leftovers.join('; ')}`)
  const { problems } = await checkLayout(page, { ...texts, language }, root)
  ctx.check(!problems.length, `${label} layout:\n  ${problems.join('\n  ')}`)
}

// Notes as OpenAI writes them in the recruiter's language (P11d-Q5), stored on a finished interview for the dialog.
const NOTES = {
  es: { summary: 'La candidata explicó con claridad cómo creó su sistema de diseño.', keyAnswers: ['Habló de sus componentes.'], strengths: ['Comunicación clara.'], concerns: ['Poca experiencia con equipos grandes.'], followUps: ['¿Cómo mide la adopción?'], transcript: 'Hola, gracias por venir.' },
  fr: { summary: 'La candidate a expliqué clairement comment elle a créé son système de design.', keyAnswers: ['Elle a décrit ses composants.'], strengths: ['Communication claire.'], concerns: ['Peu d’expérience avec de grandes équipes.'], followUps: ['Comment mesurez-vous l’adoption ?'], transcript: 'Bonjour, merci d’être venue.' },
}

/**
 * P11d-05 (P11d-Q9 … Q28 screens; §3.23): Emma in Spanish, then in French, and Sarah in the other language: the cards
 * and event lines, the other-times dialog, the call page with the consent prompt, the Upcoming strip, the schedule and
 * request dialogs, and the AI notes, with no English left and a clean layout.
 */
export default {
  name: 'P11d-05 Interviews in es and fr',
  viewports: ['D', 'M'],
  async run(ctx) {
    const pair = await seededPair()
    try {
      for (const [candidateLanguage, recruiterLanguage] of [['es', 'fr'], ['fr', 'es']]) {
        await api('/me', { method: 'PATCH', token: pair.emma, body: { language: candidateLanguage, languageExplicit: true } })
        await api('/me', { method: 'PATCH', token: pair.sarah, body: { language: recruiterLanguage, languageExplicit: true } })
        const offered = await offerApi(pair.sarah, { applicationId: pair.applicationId, aiNotes: true })
        const booked = await bookedNow(pair, { aiNotes: true })
        const notes = NOTES[recruiterLanguage]
        const { transcript, ...summary } = notes
        await db('interviews', 'updateMany', { filter: { _id: { $oid: booked.id } }, update: { $set: { transcript, notes: { ...summary, language: recruiterLanguage, generatedAt: date(Date.now()) }, 'recording.status': 'ready' } } })

        const candidate = await ctx.newPage()
        const emma = candidate.page
        await signInWithForm(emma, ctx.webUrl, '/sign-in', EMMA(), seedCredentials.password)
        await emma.goto(`${ctx.webUrl}/candidate/messages/${pair.threadId}`, { waitUntil: 'networkidle0' })
        await emma.waitForSelector(`[data-interview-card="${offered.id}"] [data-slot]`)
        await checkTranslated(ctx, emma, candidateLanguage, 'main', `${candidateLanguage} candidate thread`)
        await ctx.screenshot(emma, `${candidateLanguage}-1-thread`)
        await emma.click(`[data-interview-card="${offered.id}"] [data-other-times]`)
        await emma.waitForSelector('[role="dialog"] [data-note-field]')
        await checkTranslated(ctx, emma, candidateLanguage, '[role="dialog"]', `${candidateLanguage} other-times dialog`)
        await emma.keyboard.press('Escape')
        await emma.goto(`${ctx.webUrl}/candidate/applications`, { waitUntil: 'networkidle0' })
        await emma.waitForSelector(`[data-upcoming-interview="${booked.id}"]`)
        await checkTranslated(ctx, emma, candidateLanguage, '[data-upcoming-interviews]', `${candidateLanguage} upcoming`)
        await emma.goto(`${ctx.webUrl}/candidate/interviews/${booked.id}/call`, { waitUntil: 'networkidle0' })
        await emma.waitForSelector('[data-consent-prompt]')
        await checkTranslated(ctx, emma, candidateLanguage, 'main', `${candidateLanguage} call page`)
        await candidate.checkOverflow()
        await ctx.screenshot(emma, `${candidateLanguage}-2-call`)
        await emma.click('[data-leave-call]')
        ctx.assertClean(candidate.issues, `${candidateLanguage} candidate`)

        const recruiter = await ctx.newPage()
        const sarah = recruiter.page
        await signInWithForm(sarah, ctx.webUrl, '/recruiter/sign-in', SARAH(), seedCredentials.password)
        await sarah.goto(`${ctx.webUrl}/recruiter/messages/${pair.threadId}?card=${booked.id}`, { waitUntil: 'networkidle0' })
        await sarah.waitForSelector(`[data-interview-card="${booked.id}"] [data-open-notes]`)
        await checkTranslated(ctx, sarah, recruiterLanguage, 'main', `${recruiterLanguage} recruiter thread`)
        await sarah.click(`[data-interview-card="${booked.id}"] [data-open-notes]`)
        await sarah.waitForSelector('[data-notes-summary]')
        await checkTranslated(ctx, sarah, recruiterLanguage, '[role="dialog"]', `${recruiterLanguage} notes`)
        await ctx.screenshot(sarah, `${recruiterLanguage}-3-notes`)
        await sarah.keyboard.press('Escape')
        for (const [button, marker] of [['[data-schedule-interview]', '[data-slot-row]'], ['[data-request-documents]', '[data-document-kind]']]) {
          await sarah.click(button)
          await sarah.waitForSelector(`[role="dialog"] ${marker}`)
          await checkTranslated(ctx, sarah, recruiterLanguage, '[role="dialog"]', `${recruiterLanguage} ${button}`)
          await recruiter.checkOverflow()
          await sarah.keyboard.press('Escape')
          await sarah.waitForFunction(() => !document.querySelector('[role="dialog"]'))
        }
        await ctx.screenshot(sarah, `${recruiterLanguage}-4-thread`)
        ctx.assertClean(recruiter.issues, `${recruiterLanguage} recruiter`)
      }
    } finally {
      await api('/me', { method: 'PATCH', token: pair.emma, body: { language: 'en', languageExplicit: true } })
      await api('/me', { method: 'PATCH', token: pair.sarah, body: { language: 'en', languageExplicit: true } })
    }
  },
}
