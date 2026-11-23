import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { currentRole, hiringPath } from '@/app/roles.js'
import { Icon, TextareaField } from '@/components/ui'
import { useDraftJobMutation } from '@/features/ai/api.js'
import AiButton from '@/features/ai/components/AiButton.jsx'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import AiUsesLeft from '@/features/ai/components/AiUsesLeft.jsx'
import styles from './JobAiDraft.module.css'

// The form fields a draft can fill, in wizard order, with the value they count as empty.
const EMPTY = {
  brief: (value) => !value.trim(),
  responsibilities: (value) => !value.trim(),
  requiredSkills: (value) => value.length === 0,
  preferredSkills: (value) => value.length === 0,
  level: (value) => !value,
  experienceYears: (value) => String(value).trim() === '',
  requiredLanguages: (value) => value.length === 0,
}

// Phase 6 (2026-11-23): an agency's draft also fills its terms; the rate's period goes with the amount.
const AGENCY_EMPTY = {
  clientId: (value) => !value,
  startDate: (value) => !value,
  endDate: (value) => !value,
  rateAmount: (value) => !String(value).trim(),
  hoursPerWeek: (value) => !String(value).trim(),
}

const agencyValues = (terms) => ({
  clientId: terms.clientId ?? '',
  startDate: terms.startDate ?? '',
  endDate: terms.endDate ?? '',
  rateAmount: terms.rate ? String(terms.rate.amount) : '',
  ratePeriod: terms.rate?.period,
  hoursPerWeek: terms.hoursPerWeek == null ? '' : String(terms.hoursPerWeek),
})

/** The draft as form values (strings for text inputs). */
const asValues = (draft) => ({
  ...(draft.agency && agencyValues(draft.agency)),
  brief: draft.brief,
  responsibilities: draft.responsibilities.join('\n'),
  requiredSkills: draft.requiredSkills,
  preferredSkills: draft.preferredSkills,
  level: draft.level,
  experienceYears: String(draft.experienceYears),
  requiredLanguages: draft.requiredLanguages,
})

/**
 * The job post writer (owner 2026-11-17) on the wizard's first step: from the title, the employment type and a few
 * optional notes, AI drafts the description, responsibilities, skills, level, years and languages. It fills only the
 * fields the recruiter left empty, never overwriting their own text, and says which it filled.
 */
export default function JobAiDraft({ values, setValue }) {
  const { t } = useTranslation()
  const { data: config } = useGetConfigQuery()
  const [notes, setNotes] = useState('')
  const [filled, setFilled] = useState(null)
  const [unknownClient, setUnknownClient] = useState(null)
  const [draftJob, state] = useDraftJobMutation()
  const agency = currentRole() === 'agency'
  const empty = agency ? { ...EMPTY, ...AGENCY_EMPTY } : EMPTY
  const titleReady = values.title.trim().length >= (config?.limits.job.title.min ?? 3)

  async function handleDraft() {
    setFilled(null)
    setUnknownClient(null)
    try {
      const answer = await draftJob({ title: values.title.trim(), employmentType: values.employmentType, notes: notes.trim() }).unwrap()
      const draft = asValues(answer)
      const fields = Object.keys(empty).filter((field) => empty[field](values[field]) && !empty[field](draft[field]))
      fields.forEach((field) => setValue(field, draft[field]))
      if (fields.includes('rateAmount') && draft.ratePeriod) setValue('ratePeriod', draft.ratePeriod)
      setFilled(fields)
      // A client the notes name that is not on the Clients list yet.
      if (!values.clientId && answer.agency?.unknownClient) setUnknownClient(answer.agency.unknownClient)
    } catch {
      // AiStatus shows the failure (limit, pause, unavailable).
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="job-ai-draft" data-job-ai-draft>
      <div className={styles.head}>
        <h3 id="job-ai-draft" className={styles.title}>
          <Icon as={Sparkles} size={15} /> {t('jobs:aiDraft.title')}
        </h3>
        <AiUsesLeft />
      </div>
      <p className={styles.text}>{t(agency ? 'jobs:aiDraft.agencyText' : 'jobs:aiDraft.text')}</p>
      <TextareaField
        label={t('jobs:aiDraft.notes')}
        hint={t('jobs:aiDraft.notesHint')}
        placeholder={t(agency ? 'jobs:aiDraft.agencyNotesPlaceholder' : 'jobs:aiDraft.notesPlaceholder')}
        rows={3}
        maxLength={config?.limits.ai?.notes?.max}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <div className={styles.actions}>
        <AiButton variant="outline" leftIcon={<Icon as={Sparkles} size={14} />} loading={state.isLoading} disabled={!titleReady} onClick={handleDraft} data-job-ai-draft-button>
          {t('jobs:aiDraft.action')}
        </AiButton>
        {!titleReady && <span className={styles.text}>{t('jobs:aiDraft.needTitle')}</span>}
      </div>
      <AiStatus isLoading={false} error={state.error} onRetry={handleDraft}>
        {filled && (
          <p className={styles.done} role="status" data-job-ai-filled={filled.join(',')}>
            {filled.length
              ? t('jobs:aiDraft.filled', { fields: filled.map((field) => t(`jobs:aiDraft.fields.${field}`)).join(', ') })
              : t('jobs:aiDraft.nothing')}
          </p>
        )}
        {unknownClient && (
          <p className={styles.text} role="status" data-job-ai-unknown-client>
            {t('jobs:aiDraft.unknownClient', { name: unknownClient })}{' '}
            <Link to={hiringPath('clients')} target="_blank" rel="noreferrer">
              {t('jobs:aiDraft.addClient')}
            </Link>
          </p>
        )}
      </AiStatus>
    </section>
  )
}
