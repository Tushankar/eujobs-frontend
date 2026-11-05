import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Award, CircleHelp, CirclePlay, Layers, Search } from 'lucide-react'
import { Icon, SelectField, Skeleton, SkeletonRegion, TextField } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import SectionHeading from '@/features/recruiter/overview/components/SectionHeading.jsx'
import { useGetCoursesQuery, useGetEnrollmentsQuery, useGetSuggestionsQuery } from '@/features/learning/api.js'
import MyCourses from '@/features/learning/components/MyCourses.jsx'
import CourseCard, { CourseCardSkeleton } from '../components/CourseCard.jsx'
import SuggestionCard, { SuggestionCardSkeleton } from '../components/SuggestionCard.jsx'
import styles from './LearningPage.module.css'

const SKELETON_CARDS = 3

/**
 * Recruiter learning (§3.9, M-112): progress stats, "Suggested for you" (M-114, OQ-3: rule-based, from the company's
 * active applications per pipeline category) and the searchable course library. Streams are the courses'
 * categories. In progress = at least one lesson done and not completed (M-110).
 */
export default function LearningPage() {
  const { t } = useTranslation('learning')
  const { data: catalogue = [], isLoading } = useGetCoursesQuery()
  const { data: suggestions, isLoading: suggestionsLoading } = useGetSuggestionsQuery()
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useGetEnrollmentsQuery()
  const [query, setQuery] = useState('')
  const [stream, setStream] = useState('all')

  const streams = useMemo(() => [...new Set(catalogue.map((course) => course.category))], [catalogue])
  const streamOptions = [{ value: 'all', label: t('library.allStreams') }, ...streams.map((item) => ({ value: item, label: item }))]
  const inProgress = catalogue.filter((course) => course.enrollment?.lessonsDone > 0 && !course.enrollment.completedAt).length
  const certificates = catalogue.filter((course) => course.enrollment?.completedAt).length

  const courses = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return catalogue.filter(
      (course) =>
        (stream === 'all' || course.category === stream) &&
        (!needle || [course.title, course.category, course.summary, ...course.skillTags].join(' ').toLocaleLowerCase().includes(needle)),
    )
  }, [catalogue, query, stream])

  return (
    <div>
      <PageTitle eyebrow={t('library.eyebrow')} title={t('library.title')} description={t('library.description')} />

      <div className={styles.stats}>
        <StatCard label={t('stats.inProgress')} value={inProgress} caption={t('stats.inProgressCaptionRecruiter')} icon={CirclePlay} loading={isLoading} />
        <StatCard label={t('stats.certificates')} value={certificates} caption={t('stats.certificatesCaption')} icon={Award} loading={isLoading} />
        <StatCard label={t('stats.streams')} value={streams.length} caption={t('stats.streamsCaption')} icon={Layers} loading={isLoading} />
      </div>

      {(enrollmentsLoading || enrollments.length > 0) && (
        <section className={styles.myCourses} aria-labelledby="my-courses" data-my-courses>
          <SectionHeading id="my-courses" title={t('myCourses.title')} description={t('myCourses.lead')} />
          <MyCourses items={enrollments} loading={enrollmentsLoading} />
        </section>
      )}

      <section className={styles.suggestions} aria-labelledby="suggested" data-suggestions>
        <div className={styles.suggestionsHead}>
          <div>
            <p className={styles.eyebrow}>
              {t('suggestions.eyebrow')}
            </p>
            <h2 className={styles.suggestionsTitle} id="suggested">
              {t('suggestions.title')}
            </h2>
          </div>
        </div>
        {suggestionsLoading ? (
          <SkeletonRegion className={styles.suggestionGrid}>
            {Array.from({ length: SKELETON_CARDS }, (_, index) => (
              <SuggestionCardSkeleton key={index} />
            ))}
          </SkeletonRegion>
        ) : suggestions?.items.length > 0 ? (
          <div className={styles.suggestionGrid}>
            {suggestions.items.map((course, index) => (
              <SuggestionCard key={course.id} course={course} rank={index + 1} />
            ))}
          </div>
        ) : (
          <p className={styles.aiNote}>{t('suggestions.noneRecruiter')}</p>
        )}
        <p className={styles.aiNote}>
          <Icon as={CircleHelp} size={12} />
          {t('suggestions.howRecruiter')}
        </p>
      </section>

      <div className={styles.filters}>
        <TextField variant="filter"
          className={styles.search}
          type="search"
          aria-label={t('library.searchLabel')}
          placeholder={t('library.searchPlaceholder')}
          leftIcon={<Icon as={Search} size={15} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectField variant="filter" className={styles.stream} aria-label={t('library.streamLabel')} options={streamOptions} value={stream} onChange={(event) => setStream(event.target.value)} />
      </div>

      <section className={styles.library} aria-labelledby="learning-library">
        <SectionHeading id="learning-library" title={t('library.heading')} description={isLoading ? <Skeleton width={72} /> : t('library.count', { count: catalogue.length })} />
        {isLoading ? (
          <SkeletonRegion className={styles.grid}>
            {Array.from({ length: SKELETON_CARDS }, (_, index) => (
              <CourseCardSkeleton key={index} />
            ))}
          </SkeletonRegion>
        ) : (
          <div className={styles.grid}>
            {courses.length === 0 ? (
              <div className={styles.empty}>
                <EmptyState icon={Search} title={t('library.emptyTitle')} description={t('library.emptyText')} />
              </div>
            ) : (
              courses.map((course) => <CourseCard key={course.id} course={course} />)
            )}
          </div>
        )}
      </section>

      <p className={styles.notice}>{t('library.notice')}</p>
    </div>
  )
}
