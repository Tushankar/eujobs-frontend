import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import CandidateNotes from '../components/CandidateNotes.jsx'
import ProfileSection from '../components/ProfileSection.jsx'
import styles from './CandidateNotesPage.module.css'

/** Notes tab (M-080): the company's dated private notes on the candidate, the same list as the Hiring pipeline panel. */
export default function CandidateNotesPage() {
  const { t } = useTranslation()
  const { candidate } = useOutletContext()
  return (
    <ProfileSection labelledBy="notes-title">
      <SectionTitle id="notes-title" title={t('discovery:notesTab.title')} description={t('discovery:notesTab.description')} />
      <div className={styles.notes}>
        <CandidateNotes candidateId={candidate.id} candidateName={candidate.fullName} />
      </div>
    </ProfileSection>
  )
}
