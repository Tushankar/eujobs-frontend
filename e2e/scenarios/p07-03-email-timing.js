import { completeCandidate, MINUTE, recruiterWithJob, tickIn } from '../lib/applicants.js'
import { signInWithForm, waitForText } from '../lib/flows.js'
import { sendApi, startApi } from '../lib/messages.js'
import { mailTo, TEST_PASSWORD } from '../lib/testApi.js'

/**
 * P7-03 (M-089, U13): a message unread for 14 minutes sends nothing; at 15 minutes the candidate gets `new_message`
 * in Spanish. A second unread message soon after waits until 60 minutes after that email.
 */
export default {
  name: 'P7-03 Email timing',
  viewports: ['D'],
  async run(ctx) {
    const { recruiter, job } = await recruiterWithJob('Timing')
    const reader = await completeCandidate('Lucia', { plus: false, language: 'es' })
    const started = await startApi(recruiter.token, { candidateId: reader.id, jobId: job.id, body: 'Hola, ¿podemos hablar sobre el puesto?' })
    ctx.check(started.status === 201, `the recruiter starts the thread (${started.status})`)
    const mails = () => mailTo(reader.email, 'new_message')

    await tickIn(14 * MINUTE)
    ctx.check((await mails()).length === 0, 'no email after 14 minutes')
    await tickIn(15 * MINUTE + 5000)
    const [first] = await mails()
    ctx.check(first?.language === 'es' && first.subject.startsWith('Nuevo mensaje de'), `a Spanish email at 15 minutes (${first?.subject})`)
    ctx.check(first.params.link.endsWith(`/candidate/messages/${started.body.conversation.id}`), 'the email links to the thread')

    ctx.check((await sendApi(recruiter.token, started.body.conversation.id, 'Una pregunta más.')).status === 201, 'a second message')
    await tickIn(35 * MINUTE)
    ctx.check((await mails()).length === 1, 'no second email within 60 minutes of the first')
    await tickIn(76 * MINUTE)
    ctx.check((await mails()).length === 2, 'the second email after 60 minutes')
    ctx.note(`emails: ${(await mails()).map((mail) => mail.subject).join(' | ')}`)

    // The Spanish inbox shows both messages unread.
    const handle = await ctx.newPage()
    await signInWithForm(handle.page, ctx.webUrl, '/sign-in', reader.email, TEST_PASSWORD)
    // Sign-in lands on the Overview, still English-only in Spanish until Phase 11 (P4-Q5); this check is the inbox.
    handle.issues.length = 0
    await handle.page.goto(`${ctx.webUrl}/candidate/messages`, { waitUntil: 'networkidle0' })
    await waitForText(handle.page, '2 sin leer')
    await ctx.screenshot(handle.page, '1-spanish-inbox')
    ctx.assertClean(handle.issues, 'spanish inbox')
  },
}
