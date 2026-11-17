import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { renderMarkdown } from '../lib/markdown.js'
import { LegalDocument } from '../modules/meta/meta.model.js'
import { User } from '../modules/users/users.model.js'
import { seedCatalog } from '../seed/catalog.js'
import { LEGAL_DOCUMENTS, LEGAL_VERSION } from '../seed/data/legal.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'

useTestDb([User])
before(() => seedCatalog())

describe('GET /meta/countries (M-139)', () => {
  it('lists every enabled country worldwide: EU 27 + UK first, then Remote, then the world (owner 2026-11-16)', async () => {
    const res = await api().get('/api/v1/meta/countries')
    assert.equal(res.status, 200)
    assert.equal(res.body.total, 239)
    const byCode = Object.fromEntries(res.body.items.map((country) => [country.code, country]))
    assert.deepEqual(byCode.BG, { code: 'BG', currency: 'EUR', defaultLanguage: 'en', isRemote: false, isEu: true })
    assert.deepEqual(byCode.REMOTE, { code: 'REMOTE', currency: 'EUR', defaultLanguage: 'en', isRemote: true, isEu: false })
    assert.ok(res.body.items.slice(0, 28).every((country) => country.isEu || country.code === 'GB'))
    assert.equal(res.body.items[28].code, 'REMOTE')
    assert.deepEqual([byCode.US.currency, byCode.US.isEu, byCode.JP.currency, byCode.MX.defaultLanguage, byCode.SN.defaultLanguage], ['USD', false, 'JPY', 'es', 'fr'])
    assert.equal(byCode.FR.defaultLanguage, 'fr')
    // Disabled until the owner decides (possible sanctions; Stripe cannot charge there).
    assert.equal(byCode.RU, undefined)
  })
})

describe('GET /legal/:doc (M-191, OD12)', () => {
  for (const language of ['en', 'es', 'fr']) {
    it(`serves the current Terms draft in ${language}`, async () => {
      const res = await api().get(`/api/v1/legal/terms?language=${language}`)
      assert.equal(res.status, 200)
      assert.equal(res.body.version, LEGAL_VERSION)
      assert.equal(res.body.language, language)
      assert.equal(res.body.isDraft, true)
      assert.equal(res.body.title, LEGAL_DOCUMENTS.terms[language].title)
      assert.ok(res.body.html.includes('<h2'))
    })
  }

  it('serves the newest published version, falling back to English', async () => {
    await LegalDocument.create({ doc: 'privacy', version: 'v-next', language: 'en', title: 'Next', bodyHtml: '<p>n</p>', publishedAt: new Date() })
    const res = await api().get('/api/v1/legal/privacy?language=fr')
    assert.equal(res.body.version, 'v-next')
    assert.equal(res.body.language, 'en')
    await LegalDocument.deleteOne({ version: 'v-next' })
  })

  it('rejects an unknown document', async () => {
    const res = await api().get('/api/v1/legal/cookies')
    assert.equal(res.status, 422)
    assert.deepEqual(res.body.error.fields, { doc: 'invalid' })
  })
})

describe('GET /help/faqs (M-200)', () => {
  it('requires a session', async () => {
    assert.equal((await api().get('/api/v1/help/faqs')).status, 401)
  })

  it('differs per role and follows the language', async () => {
    const forRole = async (role, query = '') =>
      (await api().get(`/api/v1/help/faqs${query}`).set(auth(await createUser({ role })))).body.items
    const candidate = await forRole('candidate')
    const recruiter = await forRole('recruiter')
    const admin = await forRole('admin')
    assert.ok(candidate.length && recruiter.length && admin.length)
    assert.notDeepEqual(candidate.map((faq) => faq.id), recruiter.map((faq) => faq.id))
    assert.ok(!admin.some((faq) => faq.question.includes('Plus')))
    const spanish = await forRole('candidate', '?language=es')
    assert.equal(spanish[0].question, '¿Qué necesito para postularme a una oferta?')
  })

  it('answers in the user’s own language by default', async () => {
    const user = await createUser({ language: 'fr' })
    const res = await api().get('/api/v1/help/faqs').set(auth(user))
    assert.equal(res.body.items[0].question, 'De quoi ai-je besoin pour postuler à une offre ?')
  })
})

describe('lib/markdown.js', () => {
  it('renders Markdown and strips scripts, handlers and non-https links', () => {
    const html = renderMarkdown(
      '## Title\n\n<script>alert(1)</script><img src=x onerror="alert(1)">\n\n[a](javascript:alert(1)) [b](https://ok.example) [c](/legal/imprint)',
    )
    assert.ok(html.includes('<h2>Title</h2>'))
    assert.ok(!html.includes('<script') && !html.includes('onerror') && !html.includes('javascript:'))
    assert.ok(html.includes('href="https://ok.example"') && html.includes('rel="noopener noreferrer"'))
    assert.ok(html.includes('href="/legal/imprint"'))
  })
})

describe('GET /meta/languages (M-020)', () => {
  it('lists every ISO 639-1 code, sorted', async () => {
    const { body } = await api().get('/api/v1/meta/languages')
    assert.equal(body.total, 183)
    assert.ok(['en', 'es', 'fr', 'pl', 'ga', 'mt'].every((code) => body.items.includes(code)))
    assert.deepEqual(body.items, [...body.items].sort())
  })
})

describe('GET /plans (M-116, OD1)', () => {
  it('prices Free and Plus in the requested currency, else the user currency, else EUR', async () => {
    const anonymous = (await api().get('/api/v1/plans')).body.items
    assert.deepEqual(anonymous.map((plan) => [plan.key, plan.price]), [
      ['free', { amountMinor: 0, currency: 'EUR' }],
      ['plus', { amountMinor: 1000, currency: 'EUR' }],
    ])
    assert.equal(anonymous[1].name, 'Plus')
    assert.equal(anonymous[0].features.length, 4)
    assert.deepEqual(anonymous[1].entitlements, ['apply', 'message_send', 'job_alerts', 'ai'])
    // 2026-11-17: the daily AI uses from the Usage settings, yearly billing getting more; Free has none.
    assert.equal(anonymous[1].features.at(-1), '40 AI uses a day (60 with yearly billing)')
    assert.deepEqual(anonymous[1].aiDailyUses, { month: 40, year: 60 })
    assert.equal(anonymous[0].aiDailyUses, null)

    const pln = (await api().get('/api/v1/plans?currency=pln')).body.items
    assert.deepEqual(pln[1].price, { amountMinor: 4500, currency: 'PLN' })

    const user = await createUser({ pickerCountry: 'GB', language: 'es' })
    const signedIn = (await api().get('/api/v1/plans').set(auth(user))).body.items
    assert.deepEqual(signedIn[1].price, { amountMinor: 900, currency: 'GBP' })
    assert.equal(signedIn[0].name, 'Gratis')

    const badToken = await api().get('/api/v1/plans').set('Authorization', 'Bearer nope')
    assert.equal(badToken.status, 200)
  })
})
