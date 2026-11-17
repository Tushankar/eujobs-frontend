import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { refreshCompleteness } from '../modules/candidates/candidates.service.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { celebrate } from '../modules/users/celebrations.js'
import { User } from '../modules/users/users.model.js'
import { api, auth, createUser, useTestDb } from './helpers/index.js'
import { applicantCandidate } from './helpers/market.js'

/* Success modals kept on the user until seen once (owner 2026-11-17). */
useTestDb([User, CandidateProfile, VerificationSubmission])
const v1 = '/api/v1'
const me = async (user) => (await api().get(`${v1}/me`).set(auth(user))).body

describe('celebrations', () => {
  it('lists pending success moments in /me and forgets one once seen, for its owner only', async () => {
    const user = await createUser({ role: 'candidate' })
    await celebrate(user, 'plan_started', { planKey: 'plus', interval: 'year' })
    await celebrate(user._id, 'certificate', { course: 'Design basics' })
    const [first, second] = (await me(user)).celebrations
    assert.deepEqual([first.kind, first.params, second.kind], ['plan_started', { planKey: 'plus', interval: 'year' }, 'certificate'])

    const other = await createUser({ role: 'candidate' })
    await api().post(`${v1}/me/celebrations/${first.id}/seen`).set(auth(other))
    assert.equal((await me(user)).celebrations.length, 2, 'someone else cannot clear it')
    assert.equal((await api().post(`${v1}/me/celebrations/${first.id}/seen`).set(auth(user))).status, 204)
    assert.deepEqual((await me(user)).celebrations.map((item) => item.kind), ['certificate'])
  })

  it('keeps only the latest ten', async () => {
    const user = await createUser({ role: 'recruiter' })
    for (let index = 0; index < 12; index += 1) await celebrate(user, 'course_purchased', { course: `Course ${index}` })
    const items = (await User.findById(user._id)).celebrations
    assert.deepEqual([items.length, items[0].params.course, items.at(-1).params.course], [10, 'Course 2', 'Course 11'])
  })

  it('celebrates a complete profile once, the first time the checklist turns complete', async () => {
    const candidate = await applicantCandidate({ plus: false })
    await CandidateProfile.updateOne({ userId: candidate._id }, { 'completeness.complete': false })
    await refreshCompleteness(candidate._id)
    assert.equal((await CandidateProfile.findOne({ userId: candidate._id })).completeness.complete, true)
    await refreshCompleteness(candidate._id)
    assert.deepEqual((await me(candidate)).celebrations.map((item) => item.kind), ['profile_complete'])
  })
})
