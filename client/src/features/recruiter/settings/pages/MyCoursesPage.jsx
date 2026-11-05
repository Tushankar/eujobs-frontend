import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, GraduationCap } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import { Button, Icon } from '@/components/ui'
import { useGetEnrollmentsQuery } from '@/features/learning/api.js'
import MyCourses from '@/features/learning/components/MyCourses.jsx'
import SettingsCard from '../components/SettingsCard.jsx'
import SettingsLayout from '../components/SettingsLayout.jsx'
import styles from './MyCoursesPage.module.css'

/**
 * Settings › My courses (owner 2026-11-05): the recruiter's purchased and free courses with progress, the amount paid
 * and the Stripe receipt, and the certificate once earned. Recruiters have no personal profile page.
 */
export default function MyCoursesPage() {
  const { t } = useTranslation('learning')
  const { data: enrollments = [], isLoading } = useGetEnrollmentsQuery()

  return (
    <SettingsLayout>
      <SettingsCard title={t('myCourses.title')}>
        <p className={styles.lead}>{t('myCourses.settingsLead')}</p>
        <div className={styles.body}>
          {isLoading || enrollments.length > 0 ? (
            <MyCourses items={enrollments} loading={isLoading} showPayment />
          ) : (
            <EmptyState
              icon={GraduationCap}
              title={t('myCourses.emptyTitle')}
              description={t('myCourses.emptyText')}
              action={
                <Button as={Link} to="/recruiter/learning" variant="outline" rightIcon={<Icon as={ArrowRight} size={13} />}>
                  {t('myCourses.browse')}
                </Button>
              }
            />
          )}
        </div>
      </SettingsCard>
    </SettingsLayout>
  )
}
