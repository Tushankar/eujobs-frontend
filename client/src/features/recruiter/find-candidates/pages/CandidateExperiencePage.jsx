import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import Translatable from '@/features/ai/components/Translatable.jsx'
import ProfileSection from '../components/ProfileSection.jsx'
import { useCandidateText } from '../utils/candidateText.js'
import styles from './CandidateExperiencePage.module.css'

/** Experience tab (M-018, M-026): the work history, newest first, with the candidate's own descriptions. */
export default function CandidateExperiencePage() {
  const { t } = useTranslation()
  const text = useCandidateText()
  const { candidate } = useOutletContext()

  return (
    <ProfileSection labelledBy="experience-title">
      <SectionTitle id="experience-title" title={t('discovery:experienceTab.title')} />
      {candidate.workHistory.length === 0 ? (
        <p className={styles.summary}>{t('discovery:experienceTab.empty')}</p>
      ) : (
        <ol className={styles.list}>
          {candidate.workHistory.map((entry) => (
            <li key={`${entry.title}-${entry.start}`} className={styles.entry}>
              <h3 className={styles.role}>{entry.title}</h3>
              <p className={styles.meta}>
                {entry.employer} · {text.period(entry.start, entry.end, entry.current)}
              </p>
              {entry.description && (
                <Translatable source={{ entity: 'candidate', id: candidate.id, field: 'workHistory', entryId: entry.id }} texts={[entry.description]}>
                  {([description]) => <p className={styles.summary}>{description}</p>}
                </Translatable>
              )}
            </li>
          ))}
        </ol>
      )}
    </ProfileSection>
  )
}
