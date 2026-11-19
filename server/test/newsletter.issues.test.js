import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { BlogPost } from '../modules/blog/blog.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { Job } from '../modules/jobs/jobs.model.js'
import { NewsletterDelivery, NewsletterIssue, NewsletterSubscriber } from '../modules/newsletter/newsletter.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { scheduleTask, tick } from '../jobs/scheduler.js'
import { ScheduledTask } from '../jobs/models.js'
import { api, auth, createUser, linkToken, mailTo, testEmail, useTestDb } from './helpers/index.js'
import { approvedRecruiter } from './helpers/market.js'

/* Newsletter issues (2026-11-19): compose, preview, test, send in batches, unsubscribe from an issue. */
useTestDb([User, Company, Job, BlogPost, NewsletterSubscriber, NewsletterIssue, NewsletterDelivery, ScheduledTask, AuditEvent])
before(() => seedCatalog())

const v1 = '/api/v1/admin/content/newsletter'
const code = (res) => res.body.error?.code

const owner = () => createUser({ role: 'admin', isOwner: true })

async function subscribe(language = 'en', name = 'reader') {
  const email = testEmail(name)
  await api().post('/api/v1/newsletter').send({ email, language })
  await api().post('/api/v1/newsletter/confirm').send({ token: linkToken(email, 'newsletter_confirm') })
  return email
}

async function content() {
  const { user, company } = await approvedRecruiter()
  const job = await Job.create({ companyId: company._id, createdBy: user._id, title: 'Senior Product Designer', status: 'published', firstPublishedAt: new Date(), publishedAt: new Date(), country: 'GB', workPreference: 'hybrid', location: { city: 'London' } })
  const admin = await owner()
  const post = await BlogPost.create({ title: 'How to prepare for an interview', slug: 'prepare-interview', language: 'en', excerpt: 'Arrive early and prepare two questions.', bodyMarkdown: 'x'.repeat(60), bodyHtml: '<p>x</p>', status: 'published', publishedAt: new Date(), authorId: admin._id })
  return { job, post, admin }
}

describe('newsletter issues', () => {
  it('starts a draft with the newest jobs and posts, and keeps the copy per language', async () => {
    const { job, post, admin } = await content()
    const created = await api().post(v1).set(auth(admin))
    assert.equal(created.status, 201, JSON.stringify(created.body))
    assert.deepEqual([created.body.jobIds, created.body.postIds], [[String(job._id)], [String(post._id)]])
    assert.equal(created.body.jobs[0].company.length > 0, true)
    assert.ok(created.body.translations.fr.subject.length > 0)

    const id = created.body.id
    const saved = await api().patch(`${v1}/${id}`).set(auth(admin)).send({ translations: { en: { subject: 'Fresh roles', intro: 'Hello.\n\nThree new roles this week.' } } })
    assert.equal(saved.body.translations.en.subject, 'Fresh roles')
    assert.equal(code(await api().patch(`${v1}/${id}`).set(auth(admin)).send({ jobIds: ['a'.repeat(24)] })), 'VALIDATION_FAILED')

    const preview = await api().get(`${v1}/${id}/preview?language=en`).set(auth(admin))
    assert.equal(preview.body.subject, 'Fresh roles')
    assert.ok(preview.body.html.includes('Senior Product Designer') && preview.body.html.includes('/blog/prepare-interview'))
    assert.ok(preview.body.html.includes('Three new roles this week.'))
  })

  it('needs a subject and an item, and a draft only', async () => {
    const { admin } = await content()
    const { id } = (await api().post(v1).set(auth(admin))).body
    await api().patch(`${v1}/${id}`).set(auth(admin)).send({ translations: { en: { subject: '' } } })
    const noSubject = await api().post(`${v1}/${id}/send`).set(auth(admin))
    assert.deepEqual(noSubject.body.error.fields, { subject: 'required' })

    await api().patch(`${v1}/${id}`).set(auth(admin)).send({ translations: { en: { subject: 'Hi' } }, jobIds: [], postIds: [] })
    assert.deepEqual((await api().post(`${v1}/${id}/send`).set(auth(admin))).body.error.fields, { items: 'required' })
  })

  it('refuses to send with nobody subscribed, and to edit once sent', async () => {
    const { admin } = await content()
    const { id } = (await api().post(v1).set(auth(admin))).body
    assert.deepEqual((await api().post(`${v1}/${id}/send`).set(auth(admin))).body.error.fields, { recipients: 'required' })
    await subscribe()
    assert.equal((await api().post(`${v1}/${id}/send`).set(auth(admin))).status, 202)
    assert.equal(code(await api().post(`${v1}/${id}/send`).set(auth(admin))), 'LOCKED')
    assert.equal(code(await api().patch(`${v1}/${id}`).set(auth(admin)).send({ translations: { en: { subject: 'x' } } })), 'LOCKED')
    assert.equal(code(await api().delete(`${v1}/${id}`).set(auth(admin))), 'LOCKED')
  })

  it('sends one email each in the subscriber language with their own unsubscribe link, in batches, once', async () => {
    const { admin } = await content()
    const english = await subscribe('en')
    const french = await subscribe('fr')
    const { id } = (await api().post(v1).set(auth(admin))).body
    await api().patch(`${v1}/${id}`).set(auth(admin)).send({ translations: { en: { subject: 'Fresh roles' }, fr: { subject: 'Nouveaux postes' } } })

    const sent = await api().post(`${v1}/${id}/send`).set(auth(admin))
    assert.deepEqual([sent.body.status, sent.body.recipients], ['sending', 2])
    await tick(new Date(Date.now() + 1000))
    await tick(new Date(Date.now() + 2000))

    const [en] = mailTo(english, 'newsletter_issue')
    const [fr] = mailTo(french, 'newsletter_issue')
    assert.equal(mailTo(english, 'newsletter_issue').length, 1)
    assert.equal(en.subject, 'Fresh roles')
    assert.equal(fr.subject, 'Nouveaux postes')
    assert.notEqual(en.params.secondaryLink, fr.params.secondaryLink)
    assert.ok(en.params.secondaryLink.includes('/newsletter/unsubscribe?token='))
    assert.ok(fr.html.includes('Nouvelles offres'))

    const done = await api().get(`${v1}/${id}`).set(auth(admin))
    assert.deepEqual([done.body.status, done.body.deliveries.sent], ['sent', 2])
    assert.ok(done.body.finishedAt)

    // The unsubscribe link of an issue works, and an unsubscribed address is skipped by the next issue.
    const token = new URL(en.params.secondaryLink).searchParams.get('token')
    assert.deepEqual((await api().post('/api/v1/newsletter/unsubscribe').send({ token })).body, { status: 'unsubscribed' })
    const next = (await api().post(v1).set(auth(admin))).body.id
    await api().post(`${v1}/${next}/send`).set(auth(admin))
    await tick(new Date(Date.now() + 3000))
    assert.equal(mailTo(english, 'newsletter_issue').length, 1)
    assert.equal(mailTo(french, 'newsletter_issue').length, 2)
  })

  it('does not mail an address twice when the task runs again', async () => {
    const { admin } = await content()
    const email = await subscribe()
    const { id } = (await api().post(v1).set(auth(admin))).body
    await api().post(`${v1}/${id}/send`).set(auth(admin))
    await tick(new Date(Date.now() + 1000))
    await NewsletterIssue.updateOne({ _id: id }, { status: 'sending' })
    await scheduleTask({ type: 'newsletter.send', key: `newsletter:${id}:again`, dueAt: new Date(), payload: { issueId: id } })
    await tick(new Date(Date.now() + 2000))
    assert.equal(mailTo(email, 'newsletter_issue').length, 1)
  })

  it('sends a sent issue once more to the subscribers who confirmed after it, and nobody twice', async () => {
    const { admin } = await content()
    const early = await subscribe()
    const { id } = (await api().post(v1).set(auth(admin))).body
    assert.equal(code(await api().post(`${v1}/${id}/send-new`).set(auth(admin))), 'LOCKED')
    await api().post(`${v1}/${id}/send`).set(auth(admin))
    await tick(new Date(Date.now() + 1000))
    assert.equal((await api().get(`${v1}/${id}`).set(auth(admin))).body.newSubscribers, 0)
    assert.deepEqual((await api().post(`${v1}/${id}/send-new`).set(auth(admin))).body.error.fields, { recipients: 'required' })

    const late = await subscribe('fr')
    assert.equal((await api().get(`${v1}/${id}`).set(auth(admin))).body.newSubscribers, 1)
    const again = await api().post(`${v1}/${id}/send-new`).set(auth(admin))
    assert.deepEqual([again.status, again.body.status, again.body.recipients], [202, 'sending', 2])
    assert.equal(code(await api().post(`${v1}/${id}/send-new`).set(auth(admin))), 'LOCKED')
    await tick(new Date(Date.now() + 2000))
    assert.equal(mailTo(early, 'newsletter_issue').length, 1)
    assert.equal(mailTo(late, 'newsletter_issue').length, 1)
    const done = await api().get(`${v1}/${id}`).set(auth(admin))
    assert.deepEqual([done.body.status, done.body.deliveries.sent, done.body.newSubscribers], ['sent', 2, 0])
  })

  it('sends a test to the admin and limits the pages to content permissions', async () => {
    const { admin } = await content()
    const { id } = (await api().post(v1).set(auth(admin))).body
    assert.deepEqual((await api().post(`${v1}/${id}/test`).set(auth(admin)).send({ language: 'es' })).body, { status: 'sent' })
    assert.equal(mailTo(admin.email, 'newsletter_issue')[0].language, 'es')
    const candidate = await createUser()
    assert.equal((await api().get(v1).set(auth(candidate))).status, 403)
    assert.equal((await api().get(v1)).status, 401)
    const options = await api().get(`${v1}/options`).set(auth(admin))
    assert.deepEqual([options.body.jobs.length, options.body.posts.length], [1, 1])
  })
})
