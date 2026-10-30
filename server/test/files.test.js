import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { describe, it } from 'node:test'
import { config } from '../config/env.js'
import { signedUrl, storeFile } from '../lib/files.js'
import { AdminRole } from '../modules/admin/admin.model.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { CvVersion } from '../modules/cv/cv.model.js'
import { File, FileAccessLog } from '../modules/files/files.model.js'
import { User } from '../modules/users/users.model.js'
import { executable, image, textPdf } from './helpers/fixtures.js'
import { api, attach, auth, createUser, useTestDb, useTestUploads } from './helpers/index.js'

useTestDb([User, File, FileAccessLog, CvVersion, CandidateProfile, AdminRole])
useTestUploads()

const uploadCv = async (user, buffer = textPdf('Ada Lovelace, product designer'), name = 'cv.pdf', type = 'application/pdf') =>
  attach(api().post('/api/v1/candidate/cv/versions').set(auth(user)), await buffer, name, type)

describe('upload checks (M-185)', () => {
  it('needs the extension, the declared MIME and the magic bytes to agree', async () => {
    const user = await createUser()
    const photo = (buffer, name, type) => attach(api().post('/api/v1/candidate/profile/photo').set(auth(user)), buffer, name, type)
    for (const [buffer, name, type] of [
      [executable(), 'photo.jpg', 'image/jpeg'],
      [await image('png'), 'photo.jpg', 'image/jpeg'],
      [await image('png'), 'photo.png', 'application/pdf'],
      [Buffer.alloc(0), 'empty.png', 'image/png'],
    ]) {
      const res = await photo(buffer, name, type)
      assert.deepEqual([res.status, res.body.error.code], [422, 'FILE_TYPE_NOT_ALLOWED'], name)
    }
    assert.equal(await File.countDocuments(), 0)
  })
})

describe('GET /files/:fileId (U39)', () => {
  it('serves a signed URL with the right type and refuses a tampered or expired one', async () => {
    const user = await createUser()
    const file = await storeFile({ ownerId: user._id, purpose: 'cv', buffer: await textPdf('Signed'), ext: 'pdf', originalName: 'cv.pdf' })
    const url = signedUrl(file, user._id)
    const ok = await api().get(url)
    assert.equal(ok.status, 200)
    assert.equal(ok.headers['content-type'], 'application/pdf')
    assert.equal(ok.headers['content-disposition'], 'inline')
    assert.equal(ok.headers['cache-control'], 'private')

    const download = await api().get(signedUrl(file, user._id, { download: true }))
    assert.match(download.headers['content-disposition'], /^attachment; filename="?cv\.pdf"?$/)

    const tampered = url.replace(/sig=([a-f\d])/, (match, first) => `sig=${first === 'a' ? 'b' : 'a'}`)
    assert.deepEqual([(await api().get(tampered)).status, (await api().get(tampered)).body.error.code], [403, 'FORBIDDEN'])

    const exp = Math.floor(Date.now() / 1000) - 1
    const sig = createHmac('sha256', config.fileUrlSecret).update(`${file.path}|${user._id}|${exp}`).digest('hex')
    assert.equal((await api().get(`/api/v1/files/${file._id}?u=${user._id}&exp=${exp}&sig=${sig}`)).status, 403)
  })

  it('supports Range requests (D8)', async () => {
    const user = await createUser()
    const file = await storeFile({ ownerId: user._id, purpose: 'cv', buffer: await textPdf('Range'), ext: 'pdf', originalName: 'cv.pdf' })
    const res = await api().get(signedUrl(file, user._id)).set('Range', 'bytes=0-9')
    assert.equal(res.status, 206)
    assert.equal(res.headers['content-length'], '10')
  })

  it('logs a CV served to someone else once per view, never to the owner (M-187)', async () => {
    const owner = await createUser()
    const recruiter = await createUser({ role: 'recruiter' })
    const file = await storeFile({ ownerId: owner._id, purpose: 'cv', buffer: await textPdf('Logged'), ext: 'pdf', originalName: 'cv.pdf' })
    await api().get(signedUrl(file, owner._id))
    await api().get(signedUrl(file, recruiter._id)).set('Range', 'bytes=0-99')
    await api().get(signedUrl(file, recruiter._id)).set('Range', 'bytes=100-199')
    const logs = await FileAccessLog.find()
    assert.equal(logs.length, 1)
    assert.equal(String(logs[0].accessorId), String(recruiter._id))
    assert.equal(String(logs[0].ownerId), String(owner._id))
  })
})

describe('ownership', () => {
  it('gives a CV download URL to its owner only', async () => {
    const owner = await createUser()
    const { body } = await uploadCv(owner)
    const [version] = body.items
    const other = await createUser()
    assert.equal((await api().get(`/api/v1/candidate/cv/versions/${version.id}/download`).set(auth(other))).status, 404)
    const own = await api().get(`/api/v1/candidate/cv/versions/${version.id}/download`).set(auth(owner))
    assert.match(own.body.url, /download=1/)
    assert.equal((await api().get(own.body.url)).status, 200)
  })
})

describe('GET /admin/files/:fileId (documents.view)', () => {
  it('signs sensitive files for admins with documents.view only', async () => {
    const candidate = await createUser()
    const evidence = await storeFile({ ownerId: candidate._id, purpose: 'evidence', buffer: await image('png'), ext: 'png', originalName: 'passport.png' })
    const photo = await storeFile({ ownerId: candidate._id, purpose: 'photo', buffer: await image('webp'), ext: 'webp', originalName: 'me.webp' })
    const owner = await createUser({ role: 'admin', isOwner: true })
    const res = await api().get(`/api/v1/admin/files/${evidence._id}`).set(auth(owner))
    assert.deepEqual([res.status, res.body.name, res.body.mime], [200, 'passport.png', 'image/png'])
    assert.equal((await api().get(res.body.url)).status, 200)
    assert.equal((await api().get(`/api/v1/admin/files/${photo._id}`).set(auth(owner))).status, 404)

    const role = await AdminRole.create({ name: 'Moderators', nameLower: 'moderators', permissions: ['moderation.manage'] })
    const moderator = await createUser({ role: 'admin', adminAccess: { roleId: role._id } })
    const denied = await api().get(`/api/v1/admin/files/${evidence._id}`).set(auth(moderator))
    assert.deepEqual([denied.status, denied.body.error], [403, { code: 'PERMISSION_DENIED', params: { permission: 'documents.view' } }])
    // Later test files count the system roles.
    await role.deleteOne()
  })
})
