import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './SourceEvidenceModal.module.css'

/** The profile fields and the job posting behind a comparison (M-057): the same facts the scores and texts use. */
export default function SourceEvidenceModal({ open, onClose, job, evidence, skills }) {
  const { t } = useTranslation('aiInsights')
  const format = useFormat()
  const jobText = useJobText()
  if (!job || !evidence) return null
  const mode = (key) => (key ? t(`enums:workPreference.${key}`) : '—')
  const sections = [
    [
      t('source.profile'),
      [
        [t('source.skills'), format.list(skills) || '—'],
        [t('source.years'), evidence.years.candidate == null ? '—' : t('source.yearsValue', { count: evidence.years.candidate })],
        [t('source.workPreference'), mode(evidence.workMode.candidate)],
        [t('source.location'), evidence.location.countryCode ? format.country(evidence.location.countryCode) : '—'],
      ],
    ],
    [
      t('source.listing', { title: job.title, company: job.company.displayName }),
      [
        [t('source.required'), format.list(job.requiredSkills)],
        [t('source.requiredYears'), evidence.years.required == null ? '—' : t('source.requiredYearsValue', { count: evidence.years.required })],
        [t('source.workMode'), mode(evidence.workMode.job)],
        [t('source.location'), jobText.place(job)],
      ],
    ],
  ]
  return (
    <Modal open={open} onClose={onClose} title={t('source.title')} description={t('source.description')} width={560}>
      <div className={styles.body}>
        {sections.map(([heading, rows]) => (
          <section key={heading}>
            <h3 className={styles.heading}>{heading}</h3>
            <dl className={styles.list}>
              {rows.map(([label, value]) => (
                <div key={label} className={styles.row}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <div className={styles.actions}>
          <Button as={Link} to="/candidate/profile" variant="outline">
            {t('source.review')}
          </Button>
          <Button onClick={onClose}>{t('source.close')}</Button>
        </div>
      </div>
    </Modal>
  )
}
