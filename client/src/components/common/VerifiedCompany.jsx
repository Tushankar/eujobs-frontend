import { useTranslation } from 'react-i18next'
import { BadgeCheck } from 'lucide-react'
import { Icon } from '@/components/ui'
import styles from './VerifiedCompany.module.css'

/**
 * A company name (or a line ending with it) with the "Verified company" tick (owner decision P10-Q8). `verified` comes
 * from the server (approved company, active recruiter); the client never decides it. The tick is joined to the last
 * word, so a wrapping name never leaves it alone on a line; screen readers hear "Verified company".
 */
export default function VerifiedCompany({ name, verified, className }) {
  const { t } = useTranslation()
  if (!verified) return <span className={className}>{name}</span>
  const words = name.split(' ')
  const last = words.pop()
  return (
    <span className={className}>
      {words.length > 0 && `${words.join(' ')} `}
      <span className={styles.joined}>
        {last}
        <span className={styles.tick} role="img" aria-label={t('common:verifiedCompany')} title={t('common:verifiedCompany')} data-verified-company>
          <Icon as={BadgeCheck} size={14} />
        </span>
      </span>
    </span>
  )
}
