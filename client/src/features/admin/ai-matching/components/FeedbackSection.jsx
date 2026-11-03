import { useTranslation } from 'react-i18next'
import { Panel } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { useGetExplanationFeedbackQuery } from '../api.js'
import styles from './OversightSection.module.css'

/** M-067: the candidates' "Helpful" and "Needs review" answers, in total and per job (most rated first). */
export default function FeedbackSection() {
  const { t } = useTranslation('aiMatching')
  const { data } = useGetExplanationFeedbackQuery(undefined, { refetchOnMountOrArgChange: true })
  if (!data) return null
  return (
    <section className={styles.section} aria-labelledby="feedback-title" data-feedback-summary>
      <SectionTitle id="feedback-title" title={t('feedback.title')} description={t('feedback.description')} />
      <Panel padding={20} className={styles.feedback}>
        {data.jobs.length === 0 ? (
          <p className={styles.empty}>{t('feedback.empty')}</p>
        ) : (
          <>
            <p className={styles.name}>{t('feedback.totals', { helpful: data.helpful, needsReview: data.needsReview })}</p>
            <ul className={styles.feedbackList}>
              {data.jobs.map((job) => (
                <li key={job.id} data-feedback-job={job.id}>
                  <span className={styles.name}>{job.title ?? t('feedback.removedJob')}</span>
                  <span className={styles.role}>{t('feedback.job', { helpful: job.helpful, needsReview: job.needsReview })}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </section>
  )
}
