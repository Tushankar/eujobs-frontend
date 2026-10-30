import PDFDocument from 'pdfkit'
import sharp from 'sharp'
import { storeFile } from '../lib/files.js'
import { squareWebp } from '../lib/images.js'
import { extractText } from '../lib/pdfText.js'
import { CandidateProfile } from '../modules/candidates/candidates.model.js'
import { saveProfile } from '../modules/candidates/candidates.service.js'
import { CvVersion } from '../modules/cv/cv.model.js'
import { User } from '../modules/users/users.model.js'
import { VerificationSubmission } from '../modules/verification/verification.model.js'
import { CANDIDATES } from './data/candidates.js'
import { PLACES } from './data/places.js'

/*
 * Candidate profiles for seed:demo (§3.20, OQ-4): every person gets a generated CV as live version 1.
 * Complete people also get an initials photo (P3-D12), a verified phone and approved identity, academic
 * and employment checks backed by sample evidence files (OQ-4.2), reviewed by the Owner.
 */
const DAY_MS = 24 * 60 * 60 * 1000

function pdf(lines) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56 })
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    for (const line of lines) doc.fontSize(line.size ?? 11).text(line.text ?? line).moveDown(0.4)
    doc.end()
  })
}

function cvLines(person) {
  return [
    { text: person.fullName, size: 20 },
    person.headline,
    PLACES[person.city].city,
    { text: 'About', size: 14 },
    person.about,
    { text: 'Experience', size: 14 },
    ...person.workHistory.map((role) => `${role.title}, ${role.employer} (${role.start} to ${role.current ? 'present' : role.end})`),
    `${person.yearsExperience} years of professional experience`,
    { text: 'Education', size: 14 },
    ...person.education.map((entry) => `${entry.degree}, ${entry.institution} (${entry.start} to ${entry.end})`),
    { text: 'Skills', size: 14 },
    person.skills.join(', '),
  ]
}

/** P3-D12: initials on the Figma avatar colours, stored like an uploaded photo (M-013). */
async function initialsPhoto(person, ownerId) {
  const initials = person.fullName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${person.avatar.bg}"/><text x="200" y="200" dy="0.35em" text-anchor="middle" font-family="Arial, sans-serif" font-size="150" font-weight="700" fill="${person.avatar.fg}">${initials}</text></svg>`
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  const [large, small] = await Promise.all(
    [400, 96].map(async (size) => storeFile({ ownerId, purpose: 'photo', buffer: await squareWebp(png, size), ext: 'webp', originalName: 'photo.webp' })),
  )
  return { fileId: large._id, smallFileId: small._id }
}

async function approvedEvidence({ user, category, evidenceType, entryId, title, owner, now }) {
  const reviewedAt = new Date(now - 18 * DAY_MS)
  const buffer = await pdf([{ text: title, size: 18 }, user.fullName, 'Sample document created for the demo data. It is not a real document.'])
  const file = await storeFile({
    ownerId: user._id,
    purpose: 'evidence',
    buffer,
    ext: 'pdf',
    originalName: `${evidenceType}.pdf`,
    // M-186: evidence goes 30 days after the decision.
    deleteAfter: new Date(reviewedAt.getTime() + 30 * DAY_MS),
  })
  await VerificationSubmission.create({
    userId: user._id,
    category,
    evidenceType,
    entryId,
    fileId: file._id,
    status: 'approved',
    submittedAt: new Date(now - 20 * DAY_MS),
    reviewedBy: owner._id,
    reviewedAt,
  })
}

export async function seedCandidates({ emailOf, owner, now }) {
  for (const person of CANDIDATES) {
    const user = await User.findOne({ email: emailOf(person) })
    const profile = new CandidateProfile({
      userId: user._id,
      headline: person.headline,
      location: PLACES[person.city],
      about: person.about,
      yearsExperience: person.yearsExperience,
      skills: person.skills.map((name) => ({ name, key: name.toLocaleLowerCase() })),
      workPreference: person.workPreference,
      availability: person.availability,
      salaryMin: person.salaryMin,
      workHistory: person.workHistory,
      education: person.education,
      languages: person.languages ?? [],
      rightToWork: person.rightToWork ?? [],
      links: person.links,
    })

    const cv = await pdf(cvLines(person))
    const originalName = person.cvName ?? `${person.fullName.replace(/\s+/g, '_')}_CV.pdf`
    const cvFile = await storeFile({ ownerId: user._id, purpose: 'cv', buffer: cv, ext: 'pdf', originalName })
    const version = await CvVersion.create({
      userId: user._id,
      number: 1,
      fileId: cvFile._id,
      originalName,
      mime: cvFile.mime,
      size: cvFile.size,
      extractedText: await extractText(cv, 'pdf'),
    })
    profile.liveCvVersionId = version._id

    if (person.complete) {
      profile.photo = await initialsPhoto(person, user._id)
      user.phone = { e164: person.phone, verifiedAt: new Date(now - 21 * DAY_MS) }
      await user.save()
      const evidence = { user, owner, now }
      await approvedEvidence({ ...evidence, category: 'identity', evidenceType: 'passport', title: 'Passport (sample)' })
      await approvedEvidence({ ...evidence, category: 'academic', evidenceType: 'degree_certificate', entryId: profile.education[0]._id, title: 'Degree certificate (sample)' })
      await approvedEvidence({ ...evidence, category: 'employment', evidenceType: 'employment_letter', entryId: profile.workHistory[0]._id, title: 'Employment letter (sample)' })
    }
    await saveProfile(user, profile)
  }
}
