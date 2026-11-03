import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Award, CirclePlay, GraduationCap } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { useGetConfigQuery } from '@/app/api.js'
import { useGetCoursesQuery } from '@/features/learning/api.js'
import CourseCard from '../components/CourseCard.jsx'
import LevelTabs from '../components/LevelTabs.jsx'
import styles from './LearningPage.module.css'

/**
 * "Learning" (§3.9): progress stats and the catalogue filtered by level, with prices in the header country's
 * currency (M-130). In progress = at least one lesson done and not completed (M-110).
 */
export default function LearningPage() {
  const { t } = useTranslation('learning')
  const { data: config } = useGetConfigQuery()
  const { data: courses = [] } = useGetCoursesQuery()
  const [level, setLevel] = useState('all')

  const visible = level === 'all' ? courses : courses.filter((course) => course.level === level)
  const inProgress = courses.filter((course) => course.enrollment?.lessonsDone > 0 && !course.enrollment.completedAt).length
  const completed = courses.filter((course) => course.enrollment?.completedAt).length

  return (
    <>
      <PageTitle eyebrow={t('catalogue.eyebrow')} title={t('catalogue.title')} description={t('catalogue.description')} />

      <div className={styles.stats}>
        <StatCard label={t('stats.inProgress')} value={inProgress} caption={t('stats.inProgressCaption')} icon={CirclePlay} />
        <StatCard label={t('stats.badges')} value={completed} caption={t('stats.badgesCaption')} icon={Award} />
      </div>

      <section className={styles.explore} aria-labelledby="all-courses-heading">
        <h2 className={styles.sectionTitle} id="all-courses-heading">
          {t('catalogue.allTitle')}
        </h2>
        <p className={styles.sectionLead}>{t('catalogue.allLead')}</p>
        <div className={styles.tabs}>
          <LevelTabs levels={config?.enums.courseLevel ?? []} value={level} onChange={setLevel} />
        </div>
        {visible.length > 0 ? (
          <div className={styles.grid}>
            {visible.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <EmptyState icon={GraduationCap} title={t('catalogue.emptyTitle')} description={t('catalogue.emptyText')} />
        )}
      </section>

      <p className={styles.note}>{t('catalogue.note')}</p>
    </>
  )
}
