import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, it } from 'node:test'
import mongoose from 'mongoose'
import { ENUMS } from '../config/enums.js'
import { dictionaries } from '../lib/i18n.js'
import { renderEmail } from '../lib/mail/templates.js'
import { api, useTestDb } from './helpers/index.js'

useTestDb()

// BACKEND_PLAN §4.1: every enum and its number of keys.
const CATALOGUE = {
  role: 3, userStatus: 7, language: 3, workPreference: 3, employmentType: 4, jobLevel: 4, jobStatus: 4,
  salaryPeriod: 2, companySize: 6, availability: 5, languageLevel: 7, rtwRegion: 2, rtwStatus: 3,
  verificationCategory: 5, evidenceType: 9, verificationStatus: 3, kycDocType: 3, applicationStatus: 7,
  stageCategory: 6, stageTone: 3, alertFrequency: 3, cvRequestReason: 4, cvRequestStatus: 3, activityType: 13,
  planKey: 2, entitlement: 4, paymentKind: 2, paymentStatus: 3, paymentSource: 2, courseAudience: 2,
  courseLevel: 3, courseStatus: 3, lessonType: 4, questionType: 2, certificateStatus: 3, reportTargetType: 4,
  reportReason: 6, caseStatus: 3, accountDecision: 3, auditCategory: 8, actorType: 3, roleScope: 4,
  roleStatus: 2, policySignal: 3, policyStatus: 3, matchLabel: 2, aiKind: 9, emailType: 22, emailClass: 3,
  emailStatus: 5, filePurpose: 13, reportType: 3, reportPeriod: 3, legalDoc: 3, faqAudience: 3, taskType: 5,
  permission: 21, permissionGroup: 5,
}

describe('conventions', () => {
  it('reports health with the database up', async () => {
    const res = await api().get('/api/v1/health')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { status: 'ok', db: 'up' })
  })

  it('answers unknown routes with a JSON 404', async () => {
    const res = await api().get('/api/v1/no-such-route')
    assert.equal(res.status, 404)
    assert.deepEqual(res.body, { error: { code: 'NOT_FOUND' } })
  })

  it('answers malformed JSON with VALIDATION_FAILED and no stack', async () => {
    const res = await api().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":')
    assert.equal(res.status, 422)
    assert.deepEqual(res.body, { error: { code: 'VALIDATION_FAILED' } })
  })

  it('maps zod issues to field keys', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: 'not-an-email', portal: 'nowhere' })
    assert.equal(res.status, 422)
    assert.deepEqual(res.body.error.fields, { email: 'invalid', password: 'required', portal: 'invalid' })
  })
})

describe('GET /meta/config', () => {
  it('serves every §4.1 enum and the limits', async () => {
    const res = await api().get('/api/v1/meta/config')
    assert.equal(res.status, 200)
    for (const [name, count] of Object.entries(CATALOGUE)) {
      assert.equal(res.body.enums[name]?.length, count, `enum ${name}`)
    }
    assert.deepEqual(Object.keys(res.body.enums).sort(), Object.keys(CATALOGUE).sort())
    assert.deepEqual(res.body.limits.password, { min: 8, max: 128, maxBytes: 72 })
    assert.equal(res.body.limits.code.length, 6)
  })
})

// §1.3: the 23 server variables.
const SERVER_VARIABLES = [
  'NODE_ENV', 'PORT', 'CLIENT_ORIGIN', 'MONGODB_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'SMTP_HOST', 'SMTP_PORT',
  'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'SEED_PASSWORD', 'SEED_ADMIN_EMAIL', 'UPLOAD_DIR', 'FILE_URL_SECRET',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_FAST_MODEL',
  'OPENAI_EMBEDDING_MODEL', 'OPENAI_TRANSCRIBE_MODEL', 'GOOGLE_PLACES_API_KEY',
]

describe('config/env.js', () => {
  for (const name of ['JWT_SECRET', 'GOOGLE_PLACES_API_KEY']) {
    it(`fails startup naming only the missing variable (${name})`, () => {
      const env = { ...process.env }
      delete env[name]
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./config/env.js')"], {
        cwd: new URL('..', import.meta.url),
        env,
        encoding: 'utf8',
      })
      assert.notEqual(result.status, 0)
      assert.ok(result.stderr.includes(`Missing or invalid environment variables: ${name}`), 'names the variable')
      const values = SERVER_VARIABLES.map((variable) => process.env[variable]).filter((value) => value && value.length >= 8)
      assert.ok(!values.some((value) => result.stderr.includes(value)), 'no environment value is printed')
    })
  }
})

describe('indexes (§4.3)', () => {
  const indexes = async (collection) => mongoose.connection.collection(collection).indexes()
  const find = (list, key) => list.find((index) => JSON.stringify(index.key) === JSON.stringify(key))

  it('creates the unique indexes', async () => {
    const unique = {
      users: { email: 1 },
      emailtokens: { tokenHash: 1 },
      countries: { code: 1 },
      plans: { key: 1 },
      permissions: { id: 1 },
      adminroles: { nameLower: 1 },
      jobruns: { name: 1 },
      legaldocuments: { doc: 1, version: 1, language: 1 },
      appconfigs: { key: 1 },
    }
    for (const [collection, key] of Object.entries(unique)) {
      assert.equal(find(await indexes(collection), key)?.unique, true, `${collection} ${JSON.stringify(key)}`)
    }
    const pendingKey = find(await indexes('scheduledtasks'), { key: 1 })
    assert.equal(pendingKey.unique, true)
    assert.deepEqual(pendingKey.partialFilterExpression, { status: 'pending' })
  })

  it('creates the TTL indexes on email tokens and codes', async () => {
    assert.equal(find(await indexes('emailtokens'), { expiresAt: 1 }).expireAfterSeconds, 7 * 24 * 3600)
    assert.equal(find(await indexes('verificationcodes'), { expiresAt: 1 }).expireAfterSeconds, 3600)
  })

  it('has no phone uniqueness (OD3)', async () => {
    assert.equal(find(await indexes('users'), { 'phone.e164': 1 }), undefined)
  })
})

describe('server i18n (§2.11)', () => {
  const shape = (node, prefix = '') =>
    Object.entries(node).flatMap(([key, value]) => {
      const path = `${prefix}${key}`
      if (Array.isArray(value)) return [`${path}[${value.length}]`]
      return typeof value === 'object' ? shape(value, `${path}.`) : [path]
    })

  for (const language of ['es', 'fr']) {
    it(`${language} has every en key`, () => {
      assert.deepEqual(shape(dictionaries[language]), shape(dictionaries.en))
    })
  }

  it('renders every Phase 1 template in every language', () => {
    const params = { name: 'Ana', link: 'http://localhost/x', secondaryLink: 'http://localhost/y', code: '123456' }
    for (const type of ['verify_email', 'already_registered', 'recruiter_email_code', 'password_reset']) {
      for (const language of ENUMS.language) {
        const email = renderEmail(type, language, params)
        assert.ok(email.subject && email.text.includes('Ana') && email.html.includes(`lang="${language}"`), `${type} ${language}`)
      }
    }
  })
})
