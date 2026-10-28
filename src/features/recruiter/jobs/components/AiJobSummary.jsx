import { useState } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { Icon, Modal, SelectField } from '@/components/ui'
import aiSparkle from '@/assets/icons/ai-sparkle-blue-16.svg'
import aiSparkleSmall from '@/assets/icons/ai-sparkle-blue.svg'
import { JOB_STATUSES } from '../data/jobs.js'
import { formatSalary, jobMetaLine } from '../data/jobFields.js'
import styles from './AiJobSummary.module.css'

function describeRole(job) {
  const skills = job.requiredSkills ?? []
  const parts = [`This ${[job.level, job.employmentType].filter(Boolean).join(' ').toLowerCase() || 'open'} role`]
  parts.push(skills.length ? `focuses on ${skills.join(', ')}` : 'has no required skills listed yet')
  if (job.experienceYears != null)
    parts.push(`and requests approximately ${job.experienceYears}+ years of relevant experience`)
  const salary = formatSalary(job)
  return `${parts.join(' ')}.${salary ? ` The listed compensation is ${salary} per year.` : ''}`
}

function readiness(job) {
  const required = job.requiredSkills?.length ?? 0
  const preferred = job.preferredSkills?.length ?? 0
  const missing = [
    !formatSalary(job) && 'compensation',
    !job.workPreference && 'work model',
    !job.location && 'location',
    job.experienceYears == null && 'experience',
  ].filter(Boolean)
  return [
    { ok: true, text: `Role status: ${JOB_STATUSES[job.status].label}.` },
    { ok: required > 0, text: `${required} required skills and ${preferred} preferred skills are listed.` },
    {
      ok: missing.length === 0,
      text:
        missing.length === 0
          ? 'Compensation, work model, location and experience expectations are visible to candidates.'
          : `Still missing for candidates: ${missing.join(', ')}.`,
    },
  ]
}

function Summary({ job }) {
  const facts = [
    ['Work model', job.workPreference],
    ['Employment', job.employmentType],
    ['Level', job.level],
    ['Experience', job.experienceYears == null ? '' : `${job.experienceYears}+ years`],
    ['Location', job.location],
    ['Salary', formatSalary(job)],
  ]
  return (
    <>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.badge}>
            <img src={aiSparkleSmall} alt="" width={12} height={12} />
            Local structured summary
          </span>
          <span className={styles.perspective}>Recruiter perspective</span>
        </div>
        <h3 className={styles.heroTitle}>{job.title}</h3>
        <p className={styles.heroMeta}>{jobMetaLine(job)}</p>
        <p className={styles.heroText}>{describeRole(job)}</p>
      </div>

      <div className={styles.cards}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Role readiness at a glance</h3>
          <ul className={styles.checks}>
            {readiness(job).map((item) => (
              <li key={item.text} className={styles.check}>
                <Icon
                  as={item.ok ? CircleCheck : CircleAlert}
                  size={16}
                  className={item.ok ? styles.ok : styles.warn}
                />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Key role facts</h3>
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

      <h3 className={styles.skillsTitle}>Required skills</h3>
      <p className={styles.skillsNote}>
        Listed requirements only; proficiency and role-specific depth are not verified here.
      </p>
      <ul className={styles.skills}>
        {(job.requiredSkills ?? []).map((skill) => (
          <li key={skill} className={styles.skill}>
            {skill}
          </li>
        ))}
      </ul>

      <p className={styles.disclaimer}>
        This summary reorganizes existing job data from this device. No connected AI model generated new facts, and the
        summary does not rank candidates or make a hiring decision.
      </p>
    </>
  )
}

/**
 * "Ai Summary" / "Ai Job Summary" button plus its dialog: a local, structured summary of one role.
 * Pass `job` for a fixed role, or `jobs` to let the recruiter pick which role to summarise.
 */
export default function AiJobSummary({ job, jobs = [], label = 'Ai Summary' }) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const choices = job ? [job] : jobs
  const current = choices.find((item) => item.id === selectedId) ?? choices[0]

  return (
    <>
      <button type="button" className={styles.button} onClick={() => setOpen(true)}>
        <img src={aiSparkle} alt="" width={16} height={16} />
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="AI job summary" width={880}>
        {!current ? (
          <p className={styles.skillsNote}>Create a job to see its summary here.</p>
        ) : (
          <>
            {choices.length > 1 && (
              <SelectField
                label="Role"
                className={styles.picker}
                value={current.id}
                onChange={(event) => setSelectedId(event.target.value)}
                options={choices.map((item) => ({ value: item.id, label: item.title }))}
              />
            )}
            <Summary job={current} />
          </>
        )}
      </Modal>
    </>
  )
}
