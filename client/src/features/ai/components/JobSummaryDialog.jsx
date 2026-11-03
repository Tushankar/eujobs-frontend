import { useTranslation } from 'react-i18next'
import { Button, Modal } from '@/components/ui'
import AiStatus from './AiStatus.jsx'
import styles from './JobSummaryDialog.module.css'

/**
 * The AI job summary (M-058): an overview, highlights and points worth checking, written by OpenAI in the reader's
 * language, next to the posting's own required skills. `state` is the request ({ isLoading, error, data }).
 */
export default function JobSummaryDialog({ open, job, state, onRetry, onClose, actions }) {
  const { t } = useTranslation('ai')
  const summary = state.data
  const list = (key, items) =>
    items?.length > 0 && (
      <section className={styles.section}>
        <h3 className={styles.heading}>{t(`jobSummary.${key}`)}</h3>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    )
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title={t('jobSummary.title')}
      description={job && [job.title, job.company?.displayName].filter(Boolean).join(' · ')}
      footer={
        <>
          {actions}
          <Button variant="secondary" onClick={onClose}>
            {t('jobSummary.close')}
          </Button>
        </>
      }
    >
      <div className={styles.body} data-job-summary>
        <p className={styles.lead}>{t('jobSummary.lead')}</p>
        <AiStatus isLoading={state.isLoading} error={state.error} onRetry={onRetry}>
          {summary && (
            <>
              <section className={styles.section}>
                <h3 className={styles.heading}>{t('jobSummary.overview')}</h3>
                <p className={styles.overview} data-summary-overview>
                  {summary.overview}
                </p>
              </section>
              {list('highlights', summary.highlights)}
              {list('considerations', summary.considerations)}
            </>
          )}
        </AiStatus>
        {job?.requiredSkills?.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.heading}>{t('jobSummary.skills')}</h3>
            <ul className={styles.skills}>
              {job.requiredSkills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  )
}
