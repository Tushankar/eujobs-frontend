import { CircleAlert, CircleCheck, ShieldCheck } from 'lucide-react'
import { Icon, Modal } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import aiGlyph from '@/assets/icons/ai-glyph-blue-dark.svg'
import { JOB_STATUSES } from '@/features/recruiter/jobs/data/jobs.js'
import { formatSalary } from '@/features/recruiter/jobs/data/jobFields.js'
import styles from './JobSummaryModal.module.css'

function describeRole(job) {
  const skills = job.requiredSkills ?? []
  const parts = [`This ${[job.level, job.employmentType].filter(Boolean).join(' ').toLowerCase() || 'open'} role`]
  parts.push(skills.length ? `focuses on ${skills.join(', ')}` : 'has no required skills listed')
  if (job.experienceYears != null) parts.push(`and requests approximately ${job.experienceYears}+ years of relevant experience`)
  const salary = formatSalary(job)
  return `${parts.join(' ')}.${salary ? ` The listed compensation is ${salary} per year.` : ''}`
}

function reviewPoints(job) {
  const required = job.requiredSkills?.length ?? 0
  const preferred = job.preferredSkills?.length ?? 0
  const missing = [
    !formatSalary(job) && 'compensation',
    !job.workPreference && 'work model',
    !job.location && 'location',
    job.experienceYears == null && 'experience',
  ].filter(Boolean)
  return [
    { ok: true, text: `Marketplace status: ${JOB_STATUSES[job.status].label}.` },
    { ok: required > 0, text: `${required} required skills and ${preferred} preferred skills are disclosed.` },
    {
      ok: missing.length === 0,
      text:
        missing.length === 0
          ? 'Compensation, work model, location, and experience expectations are visible for moderation review.'
          : `Not yet visible for moderation review: ${missing.join(', ')}.`,
    },
  ]
}

/** "Admin AI job summary" dialog (Jobs_AI Summary): a local, structured read of one role for the marketplace review. */
export default function JobSummaryModal({ job, open, onClose }) {
  if (!job) return null

  const facts = [
    ['Work model', job.workPreference],
    ['Employment', job.employmentType],
    ['Level', job.level],
    ['Experience', job.experienceYears == null ? '' : `${job.experienceYears}+ years`],
    ['Location', job.location],
    ['Salary', formatSalary(job)],
  ]
  const skills = job.requiredSkills ?? []

  return (
    <Modal open={open} onClose={onClose} title="Admin AI job summary" width={896} className={styles.dialog}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.badge}>
            <img src={aiGlyph} alt="" width={12} height={12} />
            Local structured summary
          </span>
          <span className={styles.perspective}>Admin perspective</span>
        </div>
        <h3 className={styles.heroTitle}>{job.title}</h3>
        <p className={styles.heroMeta}>{[job.company, job.location, job.workPreference].filter(Boolean).join(' · ')}</p>
        <p className={styles.heroText}>{describeRole(job)}</p>
      </div>

      <div className={styles.cards}>
        <section className={styles.card}>
          <SectionTitle title="Marketplace review at a glance" />
          <ul className={styles.checks}>
            {reviewPoints(job).map((point) => (
              <li key={point.text} className={styles.check}>
                <Icon as={point.ok ? CircleCheck : CircleAlert} size={14} className={point.ok ? styles.ok : styles.warn} />
                <span>{point.text}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.card}>
          <SectionTitle title="Key role facts" />
          <dl className={styles.facts}>
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className={styles.factLabel}>{label}</dt>
                <dd className={styles.factValue}>{value || 'Not set'}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <SectionTitle
        className={styles.skillsHead}
        title="Required skills"
        description="Listed requirements only; proficiency and role-specific depth are not verified here."
      />
      {skills.length > 0 ? (
        <ul className={styles.skills}>
          {skills.map((skill) => (
            <li key={skill} className={styles.skill}>
              {skill}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.noSkills}>No required skills are listed for this role.</p>
      )}

      <p className={styles.disclaimer}>
        <Icon as={ShieldCheck} size={14} className={styles.ok} />
        <span>
          This summary reorganizes existing job and workspace data. No connected AI model generated new facts, and the
          summary does not approve a job, rank candidates, or make a hiring decision.
        </span>
      </p>
    </Modal>
  )
}
