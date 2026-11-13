import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { AuditEvent } from '../modules/admin/admin.model.js'
import { BlogPost } from '../modules/blog/blog.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { Company } from '../modules/companies/companies.model.js'
import { File } from '../modules/files/files.model.js'
import { NewsletterSubscriber } from '../modules/newsletter/newsletter.model.js'
import { Review } from '../modules/reviews/reviews.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { image } from './helpers/fixtures.js'
import { api, attach, auth, createUser, linkToken, mailTo, PASSWORD, shiftBack, testEmail, useTestDb, useTestUploads } from './helpers/index.js'
import { approvedRecruiter } from './helpers/market.js'

/* The public website's reviews, blog, newsletter and pricing (2026-11-13). */
useTestDb([User, CandidateProfile, Company, Review, BlogPost, File, NewsletterSubscriber, AuditEvent])
useTestUploads()
before(() => seedCatalog())

const v1 = '/api/v1'
const code = (res) => res.body.error?.code
const owner = () => createUser({ role: 'admin', isOwner: true })
const landing = (language = 'en') => api().get(`${v1}/landing?language=${language}`)
const REVIEW = { rating: 5, text: 'The smart job recommendations saved me so much time. Highly recommend!' }
const BODY = 'Arrive early, research the company and prepare two questions of your own. <script>alert(1)</script>'

describe('reviews (landing testimonials)', () => {
  it('waits for an admin, shows approved ones on the landing page, and goes back to pending after an edit', async () => {
    const candidate = await createUser({ fullName: 'Priya Sharma' })
    await CandidateProfile.create({ userId: candidate._id, headline: 'Marketing Associate' })
    const admin = await owner()

    assert.equal(code(await api().put(`${v1}/me/review`).set(auth(candidate)).send({ rating: 5, text: 'Too short' })), 'VALIDATION_FAILED')
    const saved = await api().put(`${v1}/me/review`).set(auth(candidate)).send(REVIEW)
    assert.equal(saved.status, 200, JSON.stringify(saved.body))
    assert.equal(saved.body.review.status, 'pending')
    assert.deepEqual((await landing()).body.reviews, [])

    const queue = await api().get(`${v1}/admin/moderation/reviews`).set(auth(admin))
    assert.equal(queue.body.counts.pending, 1)
    assert.equal(queue.body.items[0].author.title, 'Marketing Associate')
    const id = queue.body.items[0].id
    assert.equal((await api().post(`${v1}/admin/moderation/reviews/${id}/decision`).set(auth(admin)).send({ action: 'approve' })).status, 200)

    const [shown] = (await landing()).body.reviews
    assert.deepEqual(shown, { id, rating: 5, text: REVIEW.text, name: 'Priya S.', title: 'Marketing Associate' })
    assert.ok(await AuditEvent.exists({ type: 'moderation.review_approved' }))

    await api().put(`${v1}/me/review`).set(auth(candidate)).send({ ...REVIEW, rating: 4 })
    assert.deepEqual((await landing()).body.reviews, [])

    await api().post(`${v1}/admin/moderation/reviews/${id}/decision`).set(auth(admin)).send({ action: 'reject', reason: 'Please remove the link.' })
    const own = await api().get(`${v1}/me/review`).set(auth(candidate))
    assert.deepEqual([own.body.review.status, own.body.review.reason, own.body.review.rating], ['rejected', 'Please remove the link.', 4])

    await api().delete(`${v1}/me/review`).set(auth(candidate))
    assert.equal((await api().get(`${v1}/me/review`).set(auth(candidate))).body.review, null)
  })

  it('names an approved recruiter by job title and company, and hides suspended authors', async () => {
    const { user } = await approvedRecruiter({ fullName: 'Aisha Rahman' })
    const admin = await owner()
    await api().put(`${v1}/me/review`).set(auth(user)).send(REVIEW)
    const [item] = (await api().get(`${v1}/admin/moderation/reviews`).set(auth(admin))).body.items
    await api().post(`${v1}/admin/moderation/reviews/${item.id}/decision`).set(auth(admin)).send({ action: 'approve' })
    assert.equal((await landing()).body.reviews[0].title, 'Talent lead · Aisha Rahman Studio')

    await User.updateOne({ _id: user._id }, { status: 'suspended' })
    assert.deepEqual((await landing()).body.reviews, [])
  })

  it('is closed to recruiters awaiting approval and to anonymous visitors', async () => {
    const pending = await createUser({ role: 'recruiter', status: 'pending_review' })
    assert.equal(code(await api().put(`${v1}/me/review`).set(auth(pending)).send(REVIEW)), 'RECRUITER_NOT_APPROVED')
    assert.equal(code(await api().get(`${v1}/me/review`)), 'AUTH_REQUIRED')
  })
})

describe('blog', () => {
  const admin = {
    create: (user, body) => api().post(`${v1}/admin/content/blog`).set(auth(user)).send(body),
    patch: (user, id, body) => api().patch(`${v1}/admin/content/blog/${id}`).set(auth(user)).send(body),
    status: (user, id, status) => api().patch(`${v1}/admin/content/blog/${id}/status`).set(auth(user)).send({ status }),
    cover: async (user) => (await attach(api().post(`${v1}/admin/content/blog/covers`).set(auth(user)), await image('jpeg'), 'cover.jpg', 'image/jpeg')).body,
  }
  const post = (overrides = {}) => ({ title: '21 Job Interview Tips: How To Make a Great Impression', language: 'en', excerpt: 'What to prepare before, during and after the interview.', bodyMarkdown: BODY, ...overrides })

  it('publishes with a cover, sanitises the body and falls back to English', async () => {
    const user = await owner()
    const created = await admin.create(user, post())
    assert.equal(created.status, 201, JSON.stringify(created.body))
    assert.equal(created.body.slug, '21-job-interview-tips-how-to-make-a-great-impression')
    assert.equal(code(await admin.status(user, created.body.id, 'published')), 'VALIDATION_FAILED')
    assert.equal((await api().get(`${v1}/blog/${created.body.slug}`)).status, 404)

    const cover = await admin.cover(user)
    await admin.patch(user, created.body.id, { coverFileId: cover.id })
    const published = await admin.status(user, created.body.id, 'published')
    assert.equal(published.body.status, 'published')
    assert.ok(published.body.publishedAt)
    // Same title, new slug.
    assert.equal((await admin.create(user, post())).body.slug, '21-job-interview-tips-how-to-make-a-great-impression-2')

    const read = await api().get(`${v1}/blog/${created.body.slug}`)
    assert.equal(read.status, 200)
    assert.ok(read.body.html.includes('Arrive early'))
    assert.ok(!read.body.html.includes('<script'))
    assert.ok(read.body.coverUrl.startsWith('/api/v1/files/'))
    assert.equal((await api().get(read.body.coverUrl)).status, 200)
    assert.equal(read.body.author, 'Test Person')

    // No Spanish post yet: Spanish visitors get the English ones.
    const spanish = await api().get(`${v1}/blog?language=es`)
    assert.deepEqual([spanish.body.language, spanish.body.total], ['en', 1])
    assert.equal((await landing('es')).body.posts[0].slug, created.body.slug)

    const es = await admin.create(user, post({ title: 'Consejos para tu entrevista de trabajo', language: 'es', coverFileId: (await admin.cover(user)).id }))
    await admin.status(user, es.body.id, 'published')
    const onlySpanish = await api().get(`${v1}/blog?language=es`)
    assert.deepEqual(onlySpanish.body.items.map((item) => item.slug), ['consejos-para-tu-entrevista-de-trabajo'])
  })

  it('removes the cover file with the post and audits every step', async () => {
    const user = await owner()
    const cover = await admin.cover(user)
    const created = await admin.create(user, post({ coverFileId: cover.id }))
    await admin.status(user, created.body.id, 'published')
    assert.equal((await api().delete(`${v1}/admin/content/blog/${created.body.id}`).set(auth(user))).status, 200)
    assert.equal(await File.countDocuments({ _id: cover.id }), 0)
    const types = (await AuditEvent.find({ category: 'content' }).sort({ at: 1, _id: 1 })).map((event) => event.type)
    assert.deepEqual(types, ['content.blog_created', 'content.blog_published', 'content.blog_deleted'])
  })

  it('needs content.manage to write and content.view to read', async () => {
    const viewer = await createUser({ role: 'admin', adminAccess: { granted: ['content.view'] } })
    assert.equal((await api().get(`${v1}/admin/content/blog`).set(auth(viewer))).status, 200)
    assert.equal(code(await admin.create(viewer, post())), 'PERMISSION_DENIED')
  })
})

describe('newsletter (double opt-in)', () => {
  it('confirms by the emailed link, lists and exports confirmed addresses, and unsubscribes', async () => {
    const email = testEmail('reader')
    const res = await api().post(`${v1}/newsletter`).send({ email: email.toUpperCase(), language: 'fr' })
    assert.equal(res.status, 202)
    const [mail] = mailTo(email, 'newsletter_confirm')
    assert.equal(mail.language, 'fr')
    assert.ok(mail.params.link.includes('/newsletter/confirm?token='))
    assert.ok(mail.params.secondaryLink.includes('/newsletter/unsubscribe?token='))
    // A second request within a minute sends nothing new.
    await api().post(`${v1}/newsletter`).send({ email })
    assert.equal(mailTo(email, 'newsletter_confirm').length, 1)

    const token = linkToken(email, 'newsletter_confirm')
    assert.deepEqual((await api().post(`${v1}/newsletter/confirm`).send({ token })).body, { status: 'confirmed' })
    // Confirmed: subscribing again sends nothing.
    await shiftBack(NewsletterSubscriber, { email }, 'tokenSentAt', 2 * 60 * 1000)
    await api().post(`${v1}/newsletter`).send({ email })
    assert.equal(mailTo(email, 'newsletter_confirm').length, 1)

    const user = await owner()
    const list = await api().get(`${v1}/admin/content/subscribers`).set(auth(user))
    assert.deepEqual([list.body.counts.confirmed, list.body.items[0].email], [1, email])
    const csv = await api().get(`${v1}/admin/content/subscribers/export`).set(auth(user))
    assert.equal(csv.status, 200)
    assert.ok(csv.text.includes(email))

    assert.deepEqual((await api().post(`${v1}/newsletter/unsubscribe`).send({ token })).body, { status: 'unsubscribed' })
    assert.equal(code(await api().post(`${v1}/newsletter/confirm`).send({ token })), 'TOKEN_INVALID')
  })

  it('expires an unconfirmed link after 7 days and refuses an unknown token', async () => {
    const email = testEmail('late')
    await api().post(`${v1}/newsletter`).send({ email })
    const token = linkToken(email, 'newsletter_confirm')
    await shiftBack(NewsletterSubscriber, { email }, 'tokenSentAt', 8 * 24 * 60 * 60 * 1000)
    assert.equal(code(await api().post(`${v1}/newsletter/confirm`).send({ token })), 'TOKEN_EXPIRED')
    assert.equal(code(await api().post(`${v1}/newsletter/confirm`).send({ token: 'a'.repeat(64) })), 'TOKEN_INVALID')
  })

  it('is deleted with the account of the same email', async () => {
    const user = await createUser()
    await api().post(`${v1}/newsletter`).send({ email: user.email })
    await api().put(`${v1}/me/review`).set(auth(user)).send(REVIEW)
    const res = await api().delete(`${v1}/me`).set(auth(user)).send({ currentPassword: PASSWORD })
    assert.equal(res.status, 204, JSON.stringify(res.body))
    assert.equal(await NewsletterSubscriber.countDocuments({ email: user.email }), 0)
    assert.equal(await Review.countDocuments({ userId: user._id }), 0)
  })
})

describe('public pricing and footer contact', () => {
  it('lists the recruiter plans without a session', async () => {
    const res = await api().get(`${v1}/plans?role=recruiter&currency=EUR`)
    assert.deepEqual(res.body.items.map((plan) => plan.key), ['recruiter_free', 'recruiter_plus'])
    assert.deepEqual((await api().get(`${v1}/plans`)).body.items.map((plan) => plan.key), ['free', 'plus'])
  })

  it('sends the contact block with the landing data', async () => {
    const { contact } = (await landing()).body
    assert.deepEqual(Object.keys(contact), ['email', 'phone', 'social'])
    assert.deepEqual(Object.keys(contact.social), ['facebook', 'linkedin', 'instagram'])
  })
})
