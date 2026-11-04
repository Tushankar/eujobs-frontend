import { readFile, unlink } from 'node:fs/promises'
import { actorFor, recordAudit } from '../../lib/audit.js'
import { generate, transcribe } from '../../lib/ai.js'
import { toCsv } from '../../lib/csv.js'
import { AppError } from '../../lib/errors.js'
import { absolutePath, removeFiles, storeFile } from '../../lib/files.js'
import { t } from '../../lib/i18n.js'
import { activity, analytics, demandedSkills, overview, periodRange } from '../admin/admin.metrics.js'
import { Application } from '../applications/applications.model.js'
import { Company } from '../companies/companies.model.js'
import { ShortlistEntry } from '../discovery/discovery.model.js'
import { File } from '../files/files.model.js'
import { Certificate, Enrollment } from '../learning/learning.model.js'
import { Conversation } from '../messages/messages.model.js'
import { Payment } from '../payments/payments.model.js'
import { User } from '../users/users.model.js'
import { ReportExport } from './reports.model.js'

/*
 * Admin › Reports (M-181 … M-183, U23, P10-Q11). A report is built once: the voice note (optional) is transcribed,
 * the data for the type and period is counted, OpenAI writes an executive summary in the admin's language, and the
 * CSV is stored as a snapshot that "Download again" serves byte for byte. Reports cover all countries.
 */
const SUMMARY_SCHEMA = { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'], additionalProperties: false }
const ALL_SKILLS = 1000

/** Marketplace summary (P10-Q11): every Overview and Analytics metric, counted in the period and all time; states only all time. */
async function marketplaceRows(language, range) {
  const window = { $gte: range.start.toJSDate(), $lt: range.end.toJSDate() }
  const [all, cards, inPeriod] = await Promise.all([
    overview({}),
    analytics({}),
    Promise.all([
      User.countDocuments({ role: 'candidate', createdAt: window }),
      Application.countDocuments({ status: { $ne: 'withdrawn' }, appliedAt: window }),
      Enrollment.countDocuments({ enrolledAt: window }),
      Certificate.countDocuments({ status: 'valid', issuedAt: window }),
      Company.countDocuments({ createdAt: window }),
      Payment.countDocuments({ kind: 'course', status: 'paid', paidAt: window }),
      ShortlistEntry.countDocuments({ createdAt: window }),
      Conversation.countDocuments({ startedBy: 'recruiter', createdAt: window }),
      User.countDocuments({ role: 'recruiter', createdAt: window }),
    ]),
  ])
  const [registrations, applications, enrollments, badges, companies, purchases, shortlists, outreach, recruiters] = inPeriod
  const percent = (value) => (value === null ? '' : `${value}%`)
  const { kpis, health } = all
  const rows = [
    ['candidateRegistrations', registrations, kpis.candidateRegistrations],
    ['activeUsers', '', kpis.activeUsers],
    ['publishedJobs', '', kpis.publishedJobs],
    ['applications', applications, kpis.applications],
    ['verifiedProfiles', '', kpis.verifiedProfiles],
    ['courseEnrollments', enrollments, kpis.courseEnrollments],
    ['courseBadges', badges, kpis.courseBadges],
    ['averageRoleMatch', '', percent(kpis.averageRoleMatch.value)],
    ['companies', companies, health.companies],
    ['coursePurchases', purchases, health.coursePurchases],
    ['checksInReview', '', health.checksInReview],
    ['shortlists', shortlists, health.shortlists],
    ['outreach', outreach, health.outreach],
    ['pendingReviews', '', health.pendingReviews],
    ['shortlistConversion', '', percent(cards.shortlistConversion.percent)],
    ['recruiterAccounts', recruiters, cards.recruiterAccounts],
  ]
  return [t(language, 'reports.columns.marketplace'), ...rows.map(([key, period, total]) => [t(language, `reports.metrics.${key}`), period, total])]
}

/** Skills demand (P10-Q11): required skills of the jobs first published in the period. */
async function skillsRows(language, range) {
  const skills = await demandedSkills({ firstPublishedAt: { $gte: range.start.toJSDate(), $lt: range.end.toJSDate() } }, ALL_SKILLS)
  return [t(language, 'reports.columns.skills'), ...skills.map((skill) => [skill.skill, skill.roles])]
}

/** Platform activity: the chart's buckets (days, or the month's ISO weeks). */
async function activityRows(language, period, timeZone) {
  const { buckets } = await activity({ period, tz: timeZone })
  return [t(language, 'reports.columns.activity'), ...buckets.map((bucket) => [bucket.start, bucket.end, bucket.registrations, bucket.applications])]
}

function dataRows(type, language, period, timeZone, range) {
  if (type === 'marketplace_summary') return marketplaceRows(language, range)
  if (type === 'skills_demand') return skillsRows(language, range)
  return activityRows(language, period, timeZone)
}

function reportDto(report) {
  return {
    id: String(report._id),
    type: report.type,
    period: report.period,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    brief: report.brief ?? '',
    voiceFileName: report.voiceFileName ?? null,
    transcript: report.transcript ?? null,
    aiSummary: report.aiSummary ?? '',
    filename: report.filename,
    createdBy: report.createdByName ?? null,
    generatedAt: report.generatedAt,
  }
}

export async function listReports() {
  const items = (await ReportExport.find().sort({ generatedAt: -1 })).map(reportDto)
  return { items, total: items.length, page: 1, pageSize: items.length }
}

/** POST /admin/reports: the snapshot in the admin's language; a failed AI step stores nothing (the voice note goes too). */
export async function createReport(admin, { type, period, brief, tz }, upload) {
  const language = admin.language
  const range = periodRange(period, tz)
  const voice = upload
    ? await storeFile({ ownerId: admin._id, purpose: 'report_voice', tempPath: upload.path, ext: upload.ext, originalName: upload.originalname })
    : null
  try {
    const transcript = voice ? await transcribe(absolutePath(voice)) : null
    const table = await dataRows(type, language, period, tz, range)
    const typeLabel = t(language, `reports.types.${type}`)
    const periodLabel = `${t(language, `reports.periods.${period}`)} (${range.start.toISODate()} – ${range.end.minus({ days: 1 }).toISODate()})`
    const { summary } = await generate({
      kind: 'report_summary',
      user: admin,
      language,
      model: 'main',
      instructions:
        'You write the executive summary of an admin report for a European job marketplace: at most 120 words, plain text, no headings. ' +
        'Use only the numbers in the table; an empty cell means the metric is a current state counted only all time, never zero. ' +
        'If the admin gave a brief or a voice note transcript, answer their priorities first.',
      input: { report: typeLabel, period: periodLabel, brief: brief || null, voiceNoteTranscript: transcript, table },
      schema: SUMMARY_SCHEMA,
    })
    // U23: the summary, the brief (with the transcript), a blank row, the report's name and period, then the data.
    const briefCell = [brief, transcript && `${t(language, 'reports.csv.transcript')}: ${transcript}`].filter(Boolean).join('\n\n')
    const rows = [[t(language, 'reports.csv.executiveSummary')], [summary], [t(language, 'reports.csv.brief')], [briefCell], [], [`${typeLabel} · ${periodLabel}`], ...table]
    const generatedAt = new Date()
    const filename = `${type.replace(/_/g, '-')}-${generatedAt.toISOString().slice(0, 10)}.csv`
    const csv = await storeFile({ ownerId: admin._id, purpose: 'report_csv', buffer: Buffer.from(toCsv(rows), 'utf8'), ext: 'csv', originalName: filename })
    const report = await ReportExport.create({
      type,
      period,
      periodStart: range.start.toISODate(),
      periodEnd: range.end.minus({ days: 1 }).toISODate(),
      timeZone: tz,
      language,
      brief,
      voiceFileId: voice?._id,
      voiceFileName: upload?.originalname,
      transcript,
      aiSummary: summary,
      csvFileId: csv._id,
      filename,
      createdBy: admin._id,
      createdByName: admin.fullName,
      generatedAt,
    })
    await recordAudit({ type: 'reports.report_generated', category: 'reports', actor: actorFor(admin), target: { type: 'report', id: report._id }, params: { report: typeLabel, filename } })
    return reportDto(report)
  } catch (error) {
    if (voice) await removeFiles([voice._id])
    throw error
  } finally {
    if (upload?.path) await unlink(upload.path).catch(() => {})
  }
}

/** "Download again" (M-183): the stored bytes, audited. */
export async function reportFile(admin, id) {
  const report = await ReportExport.findById(id)
  const file = report && (await File.findById(report.csvFileId))
  if (!file) throw new AppError('NOT_FOUND')
  await recordAudit({
    type: 'reports.report_downloaded',
    category: 'reports',
    actor: actorFor(admin),
    target: { type: 'report', id: report._id },
    params: { report: t(admin.language, `reports.types.${report.type}`), filename: report.filename },
  })
  return { filename: report.filename, bytes: await readFile(absolutePath(file)) }
}
