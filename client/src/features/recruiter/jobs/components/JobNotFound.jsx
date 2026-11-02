import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft, SearchX } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import styles from './JobNotFound.module.css'

/** Friendly empty state for a job the company does not have (details and edit routes). */
export default function JobNotFound() {
  const { t } = useTranslation()
  return (
    <div className={styles.notFound}>
      <span className={styles.iconWrap}>
        <Icon as={SearchX} size={22} />
      </span>
      <h1 className={styles.title}>{t('jobs:notFound.title')}</h1>
      <p className={styles.text}>{t('jobs:notFound.text')}</p>
      <Button as={Link} to="/recruiter/jobs" leftIcon={<Icon as={ArrowLeft} size={13} />}>
        {t('jobs:notFound.back')}
      </Button>
    </div>
  )
}
