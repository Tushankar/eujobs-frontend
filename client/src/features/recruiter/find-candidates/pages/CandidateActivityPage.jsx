import { useOutletContext } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { Icon } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import ProfileSection from '../components/ProfileSection.jsx'
import styles from './CandidateActivityPage.module.css'

const formatTime = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default function CandidateActivityPage() {
  const { stageName, activity } = useOutletContext()
  const hasOutreach = activity.some((event) => event.type === 'outreach')

  return (
    <ProfileSection labelledBy="activity-title">
      <SectionTitle id="activity-title" title="Candidate activity" />
      <p className={styles.stage}>
        <Icon as={CircleCheck} size={16} strokeWidth={2} className={styles.icon} />
        <span>
          Current stage: <strong>{stageName}</strong>
        </span>
      </p>
      {!hasOutreach && (
        <p className={styles.empty}>No outreach yet. A thoughtful introduction is a good place to start.</p>
      )}
      {activity.length > 0 && (
        <>
          <h3 className={styles.heading}>Your activity on this device</h3>
          <ul className={styles.list}>
            {activity.map((event) => (
              <li key={event.id} className={styles.event}>
                <span>{event.text}</span>
                <time className={styles.time} dateTime={event.at}>
                  {formatTime(event.at)}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}
    </ProfileSection>
  )
}
