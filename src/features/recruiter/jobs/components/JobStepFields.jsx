import { CircleAlert, CircleCheck } from 'lucide-react'
import { Icon, SelectField, TextareaField, TextField } from '@/components/ui'
import { EMPLOYMENT_TYPES, WORK_PREFERENCES } from '../data/jobs.js'
import { analyzeJob, formatSalary, jobMetaLine, JOB_LEVELS, valuesToJob } from '../data/jobFields.js'
import JobPosting from './JobPosting.jsx'
import SkillPicker from './SkillPicker.jsx'
import styles from './JobStepFields.module.css'

/** The fields (or read-only content) of one wizard step. `bind(name)` returns value/onChange/error props. */
export default function JobStepFields({ stepId, values, errors, bind, setValue, choosesStatus }) {
  switch (stepId) {
    case 'basics':
      return (
        <div className={styles.stack}>
          <TextField
            label="Job title"
            placeholder="e.g. Senior Product Designer"
            autoComplete="off"
            {...bind('title')}
          />
          <div className={styles.pair}>
            <TextField label="Company" autoComplete="organization" {...bind('company')} />
            <SelectField label="Employment type" options={EMPLOYMENT_TYPES} {...bind('employmentType')} />
          </div>
        </div>
      )
    case 'responsibilities':
      return (
        <div className={styles.stack}>
          <TextareaField
            label="The brief"
            hint="A few sentences on the team, the impact of the role and what success looks like."
            rows={5}
            {...bind('description')}
          />
          <TextareaField
            label="Responsibilities"
            hint="One responsibility per line. Optional, but three or more help matching."
            rows={5}
            {...bind('responsibilities')}
          />
        </div>
      )
    case 'required-skills':
      return (
        <SkillPicker
          label="Required skills"
          hint="Skills candidates must list on their profile to be considered relevant."
          error={errors.requiredSkills}
          value={values.requiredSkills}
          excluded={values.preferredSkills}
          onChange={(skills) => setValue('requiredSkills', skills)}
        />
      )
    case 'preferred-skills':
      return (
        <SkillPicker
          label="Preferred skills"
          hint="Nice to have. These never exclude a candidate. Optional."
          value={values.preferredSkills}
          excluded={values.requiredSkills}
          onChange={(skills) => setValue('preferredSkills', skills)}
        />
      )
    case 'experience':
      return (
        <div className={styles.pair}>
          <SelectField label="Seniority level" placeholder="Choose a level" options={JOB_LEVELS} {...bind('level')} />
          <TextField
            label="Minimum years of experience"
            inputMode="numeric"
            placeholder="e.g. 5"
            {...bind('experienceYears')}
          />
        </div>
      )
    case 'location':
      return (
        <div className={styles.stack}>
          <div className={styles.pair}>
            <TextField label="Location" placeholder="e.g. San Francisco, US" autoComplete="off" {...bind('location')} />
            <SelectField
              label="Work preference"
              placeholder="Choose a work preference"
              options={WORK_PREFERENCES}
              {...bind('workPreference')}
            />
          </div>
          <div className={styles.pair}>
            <TextField
              label="Minimum salary (USD per year)"
              inputMode="numeric"
              placeholder="e.g. 140000"
              {...bind('salaryMin')}
            />
            <TextField
              label="Maximum salary (USD per year)"
              inputMode="numeric"
              placeholder="e.g. 180000"
              {...bind('salaryMax')}
            />
          </div>
          <p className={styles.note}>
            Salary is optional, but roles with a range usually attract more relevant applicants.
          </p>
        </div>
      )
    case 'analysis':
      return (
        <div>
          <p className={styles.note}>
            A local, rule-based review of what you have entered. No AI model is connected, and nothing here ranks or
            rejects candidates.
          </p>
          <ul className={styles.checks}>
            {analyzeJob(values).map((check) => (
              <li key={check.id} className={styles.check}>
                <Icon
                  as={check.ok ? CircleCheck : CircleAlert}
                  size={16}
                  className={check.ok ? styles.ok : styles.warn}
                />
                <span>{check.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    case 'review': {
      const job = valuesToJob(values)
      return (
        <div className={styles.preview}>
          <h3 className={styles.previewTitle}>{job.title || 'Untitled role'}</h3>
          <p className={styles.previewMeta}>
            {[jobMetaLine(job), job.employmentType, job.level].filter(Boolean).join(' · ')}
          </p>
          <JobPosting job={job} />
        </div>
      )
    }
    case 'publish': {
      const job = valuesToJob(values)
      return (
        <div>
          <p className={styles.note}>
            {choosesStatus
              ? 'Save this role as a draft to finish it later, or publish it to list it with your open roles.'
              : 'Everything is ready. Saving updates this role in your Jobs list.'}
          </p>
          <dl className={styles.summary}>
            <div>
              <dt>Role</dt>
              <dd>{job.title}</dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>{[job.location, job.workPreference].filter(Boolean).join(' · ') || 'Not set'}</dd>
            </div>
            <div>
              <dt>Required skills</dt>
              <dd>{job.requiredSkills.length || 'None'}</dd>
            </div>
            <div>
              <dt>Salary</dt>
              <dd>{formatSalary(job) || 'Not shown'}</dd>
            </div>
          </dl>
        </div>
      )
    }
    default:
      return null
  }
}
