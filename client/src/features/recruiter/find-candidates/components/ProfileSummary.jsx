import { useTranslation } from 'react-i18next'
import { BadgeCheck, Earth, ExternalLink, MapPin } from 'lucide-react'
import { Avatar, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useCandidateText } from '../utils/candidateText.js'
import styles from './ProfileSummary.module.css'

/**
 * Header card of the candidate profile (M-026, M-168): photo, name, current role, availability, listed facts, the
 * first four skills, links and a tick per approved identity, academic and employment check.
 */
export default function ProfileSummary({ candidate }) {
  const { t } = useTranslation()
  const text = useCandidateText()
  const checks = Object.entries(candidate.verification.checks).filter(([, approved]) => approved)
  const links = [
    ['linkedin', candidate.links.linkedin],
    ['portfolio', candidate.links.portfolio],
  ].filter(([, url]) => url)

  return (
    <section className={styles.card} aria-labelledby="candidate-name">
      <div className={styles.identity}>
        <Avatar name={candidate.fullName} src={candidate.photoUrl ?? undefined} size={56} />
        <div className={styles.text}>
          <h1 className={styles.name} id="candidate-name">
            {candidate.fullName}
          </h1>
          <p className={styles.role}>{text.role(candidate.currentRole) || candidate.headline}</p>
        </div>
        <PillBadge tone="success" dot className={styles.availability}>
          {t(`enums:availability.${candidate.availability}`)}
        </PillBadge>
      </div>

      <p className={styles.facts}>
        <span className={styles.fact}>
          <Icon as={MapPin} size={13} strokeWidth={2} />
          {text.location(candidate)}
        </span>
        <span>{t('discovery:profile.years', { count: candidate.yearsExperience })}</span>
        {candidate.workPreference && (
          <span className={styles.fact}>
            <Icon as={Earth} size={13} strokeWidth={2} />
            {t(`enums:workPreference.${candidate.workPreference}`)}
          </span>
        )}
      </p>

      <ul className={styles.skills} aria-label={t('discovery:card.skills')}>
        {candidate.skills.slice(0, 4).map((skill) => (
          <li key={skill}>
            <PillBadge>{skill}</PillBadge>
          </li>
        ))}
      </ul>

      {(checks.length > 0 || links.length > 0) && (
        <div className={styles.extras}>
          {checks.map(([category]) => (
            <PillBadge key={category} tone="info" data-check={category}>
              <Icon as={BadgeCheck} size={11} strokeWidth={2} />
              {t(`discovery:profile.checks.${category}`)}
            </PillBadge>
          ))}
          {links.map(([key, url]) => (
            <a key={key} href={url} target="_blank" rel="noopener noreferrer" className={styles.link}>
              {t(`discovery:profile.${key}`)}
              <Icon as={ExternalLink} size={11} strokeWidth={2} />
            </a>
          ))}
        </div>
      )}
    </section>
  )
}
