import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Award, CirclePlay, Compass, GraduationCap } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { useGetConfigQuery } from '@/app/api.js'
import { Skeleton, SkeletonRegion } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import { useGetCoursesQuery, useGetSuggestionsQuery } from '@/features/learning/api.js'
import CourseCard, { CourseCardSkeleton } from '../components/CourseCard.jsx'
import LevelTabs from '../components/LevelTabs.jsx'
import styles from './LearningPage.module.css'

/**
 * "Learning" (§3.9): progress stats, "Suggested for you" (M-114, OQ-3: courses tagged with the gap skills of saved,
 * applied and For-you jobs; Free and Plus alike) and the catalogue filtered by level, with prices in the header
 * country's currency (M-130). In progress = at least one lesson done and not completed (M-110).
 */
export default function LearningPage() {
  const { t } = useTranslation('learning')
  const { data: config } = useGetConfigQuery()
  const { data: courses = [], isLoading: coursesLoading } = useGetCoursesQuery()
  const { data: suggestions, isLoading: suggestionsLoading } = useGetSuggestionsQuery()
  const format = useFormat()
  const [level, setLevel] = useState('all')

  const visible = level === 'all' ? courses : courses.filter((course) => course.level === level)
  const inProgress = courses.filter((course) => course.enrollment?.lessonsDone > 0 && !course.enrollment.completedAt).length
  const completed = courses.filter((course) => course.enrollment?.completedAt).length

  return (
    <>
      <PageTitle eyebrow={t('catalogue.eyebrow')} title={t('catalogue.title')} description={t('catalogue.description')} />

      <div className={styles.stats}>
        <StatCard label={t('stats.inProgress')} value={inProgress} caption={t('stats.inProgressCaption')} icon={CirclePlay} loading={coursesLoading} />
        <StatCard label={t('stats.badges')} value={completed} caption={t('stats.badgesCaption')} icon={Award} loading={coursesLoading} />
        <StatCard label={t('stats.skills')} value={suggestions?.gapSkills.length ?? 0} caption={t('stats.skillsCaption')} icon={Compass} loading={suggestionsLoading} />
      </div>

      <section className={styles.section} aria-labelledby="suggested-heading" data-suggestions>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle} id="suggested-heading">
              {t('suggestions.title')}
            </h2>
            <p className={styles.sectionLead}>
              {suggestionsLoading ? (
                <Skeleton width={260} height={8} />
              ) : suggestions?.gapSkills.length ? (
                t('suggestions.lead', { skills: format.list(suggestions.gapSkills) })
              ) : (
                t('suggestions.noGaps')
              )}
            </p>
            {suggestions?.planSkills.length > 0 && (
              <p className={styles.sectionLead} data-plan-lead>
                {t('suggestions.plan', { skills: format.list(suggestions.planSkills) })}
              </p>
            )}
          </div>
        </div>
        {suggestionsLoading ? (
          <SkeletonRegion className={styles.grid}>
            <CourseCardSkeleton />
            <CourseCardSkeleton />
            <CourseCardSkeleton />
          </SkeletonRegion>
        ) : suggestions?.items.length > 0 ? (
          <div className={styles.grid}>
            {suggestions.items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          (suggestions?.gapSkills.length > 0 || suggestions?.planSkills.length > 0) && <p className={styles.sectionLead}>{t('suggestions.empty')}</p>
        )}
      </section>

      <section className={styles.explore} aria-labelledby="all-courses-heading">
        <h2 className={styles.sectionTitle} id="all-courses-heading">
          {t('catalogue.allTitle')}
        </h2>
        <p className={styles.sectionLead}>{t('catalogue.allLead')}</p>
        <div className={styles.tabs}>
          <LevelTabs levels={config?.enums.courseLevel ?? []} value={level} onChange={setLevel} />
        </div>
        {coursesLoading ? (
          <SkeletonRegion className={styles.grid}>
            <CourseCardSkeleton />
            <CourseCardSkeleton />
            <CourseCardSkeleton />
          </SkeletonRegion>
        ) : visible.length > 0 ? (
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
