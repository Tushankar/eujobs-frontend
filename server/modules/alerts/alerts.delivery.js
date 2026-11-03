import { DateTime } from 'luxon'
import { config } from '../../config/env.js'
import { LIMITS } from '../../config/limits.js'
import { taskHandlers, tickJobs } from '../../jobs/scheduler.js'
import { interpolate, t } from '../../lib/i18n.js'
import { sendEmail } from '../../lib/mailer.js'
import { matchesKeywords } from '../../lib/skills.js'
import { Company } from '../companies/companies.model.js'
import { Job } from '../jobs/jobs.model.js'
import { haystack, visibleFilter } from '../jobs/jobs.search.js'
import { planState } from '../payments/payments.service.js'
import { User } from '../users/users.model.js'
import { AlertMatch, JobAlert } from './alerts.model.js'

/*
 * Alert delivery (§3.6, §3.17). Instant alerts run once per job, on its first publish (M-097, `alerts.instant` task
 * scheduled by the jobs service). Daily and weekly digests are checked on every tick: 08:00, and Monday 08:00, in
 * the user's time zone, listing the open jobs first published since the last digest, at most 20 (the newest) with
 * "See all"; empty digests are not sent (U12).
 * Alerts of candidates without `job_alerts` are paused (M-119). A job goes out at most once per alert.
 */
const DIGEST_HOUR = 8

/** M-098, U35: the alert's country (Remote included) and city, and every keyword in the job's fields and labels. */
export function alertMatches(alert, job, company) {
  if (job.country !== alert.country) return false
  if (alert.location?.placeId && job.location?.placeId !== alert.location.placeId) return false
  return matchesKeywords(alert.keywords, haystack(job, company, alert.language))
}

/** The job line of an email: "Title · Company · City" (Remote jobs show the label in the recipient's language). */
function jobLine(job, company, language) {
  const where = job.country === 'REMOTE' ? t(language, 'labels.workPreference.remote') : job.location?.city
  return [job.title, company.displayName, where].filter(Boolean).join(' · ')
}

/** The candidates in `ids` whose plan includes job alerts; others' alerts are paused. */
async function entitledIds(ids) {
  const unique = [...new Set(ids.map(String))]
  const states = await Promise.all(unique.map((id) => planState(id)))
  return new Set(unique.filter((id, index) => states[index].entitlements.includes('job_alerts')))
}

/** The jobs not yet sent for this alert. */
async function unsentJobs(alert, jobs) {
  const sent = new Set((await AlertMatch.find({ alertId: alert._id, jobId: { $in: jobs.map((job) => job._id) } }, 'jobId')).map((match) => String(match.jobId)))
  return jobs.filter((job) => !sent.has(String(job._id)))
}

/** Records the matches first; a job already sent for this alert is dropped (the unique pair). */
async function claimMatches(alert, jobs, mode, now) {
  const fresh = await unsentJobs(alert, jobs)
  if (fresh.length) await AlertMatch.insertMany(fresh.map((job) => ({ alertId: alert._id, jobId: job._id, mode, sentAt: now })), { ordered: false })
  return fresh
}

async function sendInstantAlerts({ jobId }, task, now) {
  const job = await Job.findOne({ _id: jobId, ...(await visibleFilter()) })
  if (!job) return
  const alerts = await JobAlert.find({ frequency: 'instant', active: true, country: job.country })
  const entitled = await entitledIds(alerts.map((alert) => alert.candidateId))
  const company = await Company.findById(job.companyId, 'displayName industry')
  for (const alert of alerts.filter((item) => entitled.has(String(item.candidateId)) && alertMatches(item, job, company))) {
    if (!(await claimMatches(alert, [job], 'instant', now)).length) continue
    const user = await User.findById(alert.candidateId)
    await sendEmail({
      type: 'alert_instant',
      to: user.email,
      userId: user._id,
      language: user.language,
      params: {
        name: user.fullName,
        alertName: alert.name,
        job: job.title,
        items: [jobLine(job, company, user.language)],
        link: `${config.clientOrigin}/candidate/jobs/${job._id}`,
        secondaryLink: `${config.clientOrigin}/candidate/job-alerts`,
      },
    })
  }
}

/** The latest digest slot at or before `now`: 08:00 local (daily) or Monday 08:00 local (weekly). */
export function digestSlot(now, frequency, timeZone) {
  const local = DateTime.fromJSDate(now).setZone(timeZone || 'UTC')
  let slot = local.set({ hour: DIGEST_HOUR, minute: 0, second: 0, millisecond: 0 })
  if (frequency === 'weekly') slot = slot.set({ weekday: 1 })
  if (slot > local) slot = slot.minus(frequency === 'weekly' ? { weeks: 1 } : { days: 1 })
  return slot.toJSDate()
}

async function sendDigests(now) {
  const alerts = await JobAlert.find({ frequency: { $in: ['daily', 'weekly'] }, active: true })
  const users = new Map((await User.find({ _id: { $in: alerts.map((alert) => alert.candidateId) } })).map((user) => [String(user._id), user]))
  const due = alerts.filter((alert) => {
    const user = users.get(String(alert.candidateId))
    return user && (alert.lastDigestAt ?? alert.createdAt) < digestSlot(now, alert.frequency, user.timezone)
  })
  if (!due.length) return
  const entitled = await entitledIds(due.map((alert) => alert.candidateId))
  const visible = await visibleFilter()
  for (const alert of due.filter((item) => entitled.has(String(item.candidateId)))) {
    const user = users.get(String(alert.candidateId))
    const jobs = await Job.find({ ...visible, country: alert.country, firstPublishedAt: { $gt: alert.lastDigestAt ?? alert.createdAt, $lte: now } }).sort({ firstPublishedAt: -1 })
    const companies = new Map((await Company.find({ _id: { $in: jobs.map((job) => job.companyId) } }, 'displayName industry')).map((company) => [String(company._id), company]))
    const matching = jobs.filter((job) => alertMatches(alert, job, companies.get(String(job.companyId))))
    const unsent = await unsentJobs(alert, matching)
    // The newest jobs only; the rest are reached through "See all" and are not recorded as sent.
    const fresh = await claimMatches(alert, unsent.slice(0, LIMITS.jobAlert.digestItems), 'digest', now)
    if (fresh.length) {
      const countLabel = interpolate(t(user.language, `labels.alertJobs.${unsent.length === 1 ? 'one' : 'other'}`), { count: unsent.length })
      const more = unsent.length > fresh.length && {
        shown: fresh.length,
        total: unsent.length,
        moreLink: `${config.clientOrigin}/candidate/jobs?${new URLSearchParams({ q: alert.keywords })}`,
      }
      await sendEmail({
        type: alert.frequency === 'daily' ? 'alert_daily' : 'alert_weekly',
        to: user.email,
        userId: user._id,
        language: user.language,
        params: {
          name: user.fullName,
          alertName: alert.name,
          countLabel,
          items: fresh.map((job) => jobLine(job, companies.get(String(job.companyId)), user.language)),
          link: `${config.clientOrigin}/candidate/jobs`,
          secondaryLink: `${config.clientOrigin}/candidate/job-alerts`,
          ...more,
        },
      })
    }
    await JobAlert.updateOne({ _id: alert._id }, { lastDigestAt: now }, { timestamps: false })
  }
}

taskHandlers['alerts.instant'] = sendInstantAlerts
tickJobs.push({ name: 'alert-digests', run: sendDigests })
