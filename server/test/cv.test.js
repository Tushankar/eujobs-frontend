import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { describe, it } from 'node:test'
import { absolutePath } from '../lib/files.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { CvVersion } from '../modules/cv/cv.model.js'
import { File } from '../modules/files/files.model.js'
import { User } from '../modules/users/users.model.js'
import { docx, imagePdf, MB, padded, textPdf } from './helpers/fixtures.js'
import { api, attach, auth, createUser, useTestDb, useTestUploads } from './helpers/index.js'

useTestDb([User, CvVersion, CandidateProfile, File])
useTestUploads()

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const upload = (user, buffer, name, type = 'application/pdf') => attach(api().post('/api/v1/candidate/cv/versions').set(auth(user)), buffer, name, type)
const list = async (user) => (await api().get('/api/v1/candidate/cv').set(auth(user))).body

describe('CV upload and extraction (M-027, U18, P3-D7)', () => {
  it('extracts a text PDF and makes it the live version', async () => {
    const user = await createUser()
    const res = await upload(user, await textPdf(['Ada Lovelace', 'Product designer with five years of experience in design systems.']), 'Ada_CV.pdf')
    assert.equal(res.status, 201)
    const [version] = res.body.items
    assert.deepEqual([version.number, version.live, version.noReadableText, version.originalName], [1, true, false, 'Ada_CV.pdf'])
    assert.equal(res.body.liveVersionId, version.id)
    const stored = await CvVersion.findById(version.id)
    assert.match(stored.extractedText, /design systems/)
    const me = await api().get('/api/v1/me').set(auth(user))
    assert.equal(me.body.completeness.items.find((item) => item.key === 'live_cv').done, true)
  })

  it('flags an image-only PDF as "No readable text" and reads a DOCX', async () => {
    const user = await createUser()
    const scanned = await upload(user, await imagePdf(), 'scan.pdf')
    assert.equal(scanned.body.items[0].noReadableText, true)
    const word = await upload(user, await docx('Grace Hopper, engineer and teacher of compilers and programming languages.'), 'cv.docx', DOCX)
    assert.equal(word.status, 201)
    assert.equal(word.body.items[0].noReadableText, false)
    assert.match((await CvVersion.findById(word.body.items[0].id)).extractedText, /compilers/)
  })

  it('refuses other types and files over 10 MB', async () => {
    const user = await createUser()
    const png = await upload(user, Buffer.from('\x89PNG\r\n\x1a\n'), 'cv.png', 'image/png')
    assert.equal(png.body.error.code, 'FILE_TYPE_NOT_ALLOWED')
    const big = await upload(user, padded(await textPdf('Big'), 11 * MB), 'big.pdf')
    assert.deepEqual([big.status, big.body.error.code], [413, 'FILE_TOO_LARGE'])
  })

  it('keeps at most 20 versions; deleted ones do not count and numbers are never reused', async () => {
    const user = await createUser()
    const first = (await upload(user, await textPdf('Version one'), 'one.pdf')).body.items[0]
    const placeholder = await File.findOne({ ownerId: user._id })
    await CvVersion.insertMany(Array.from({ length: 19 }, (_, i) => ({ userId: user._id, number: i + 2, fileId: placeholder._id })))
    const over = await upload(user, await textPdf('Twenty-one'), 'over.pdf')
    assert.deepEqual([over.status, over.body.error.fields, over.body.error.params], [422, { file: 'too_many' }, { max: 20 }])

    const twentieth = (await list(user)).items.find((item) => item.number === 20)
    await api().delete(`/api/v1/candidate/cv/versions/${twentieth.id}`).set(auth(user))
    const next = await upload(user, await textPdf('After delete'), 'next.pdf')
    assert.equal(next.status, 201)
    assert.equal(next.body.items[0].number, 21)
    assert.ok(next.body.items.some((item) => item.id === first.id))
  })
})

describe('live, download and delete (M-028, M-030)', () => {
  it('sets any own version live and deletes only non-live ones with their file', async () => {
    const user = await createUser()
    const one = (await upload(user, await textPdf('First CV'), 'one.pdf')).body.items[0]
    const two = (await upload(user, await textPdf('Second CV'), 'two.pdf')).body.items[0]
    assert.equal((await list(user)).liveVersionId, two.id)

    const live = await api().post(`/api/v1/candidate/cv/versions/${one.id}/live`).set(auth(user))
    assert.equal(live.body.liveVersionId, one.id)
    const refused = await api().delete(`/api/v1/candidate/cv/versions/${one.id}`).set(auth(user))
    assert.deepEqual([refused.status, refused.body.error.code], [409, 'CONFLICT'])

    const file = await File.findById((await CvVersion.findById(two.id)).fileId)
    const deleted = await api().delete(`/api/v1/candidate/cv/versions/${two.id}`).set(auth(user))
    assert.deepEqual(deleted.body.items.map((item) => item.id), [one.id])
    assert.equal(existsSync(absolutePath(file)), false)
    assert.equal(await File.exists({ _id: file._id }), null)
    assert.equal((await CvVersion.findById(two.id)).fileId, null)
    assert.equal((await api().get(`/api/v1/candidate/cv/versions/${two.id}/download`).set(auth(user))).status, 404)
  })
})
