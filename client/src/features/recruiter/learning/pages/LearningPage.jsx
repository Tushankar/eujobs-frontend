import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Award, CircleHelp, CirclePlay, Layers, Search, Sparkles } from 'lucide-react'
import { Icon, SelectField, TextField } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import SectionHeading from '@/features/recruiter/overview/components/SectionHeading.jsx'
import { useGetCoursesQuery, useGetSuggestionsQuery } from '@/features/learning/api.js'
import CourseCard from '../components/CourseCard.jsx'
import SuggestionCard from '../components/SuggestionCard.jsx'
import styles from './LearningPage.module.css'

/**
 * Recruiter learning (§3.9, M-112): progress stats, "Suggested for you" (M-114, OQ-3: rule-based, from the company's
 * active applications per pipeline category) and the searchable course library. Streams are the courses'
 * categories. In progress = at least one lesson done and not completed (M-110).
 */
export default function LearningPage() {
  const { t } = useTranslation('learning')
  const { data: catalogue = [] } = useGetCoursesQuery()
  const { data: suggestions } = useGetSuggestionsQuery()
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
        <StatCard label={t('stats.inProgress')} value={inProgress} caption={t('stats.inProgressCaptionRecruiter')} icon={CirclePlay} />
        <StatCard label={t('stats.certificates')} value={certificates} caption={t('stats.certificatesCaption')} icon={Award} />
        <StatCard label={t('stats.streams')} value={streams.length} caption={t('stats.streamsCaption')} icon={Layers} />
      </div>

      <section className={styles.suggestions} aria-labelledby="suggested" data-suggestions>
        <div className={styles.suggestionsHead}>
          <div>
            <p className={styles.eyebrow}>
              <Icon as={Sparkles} size={13} />
              {t('suggestions.eyebrow')}
            </p>
            <h2 className={styles.suggestionsTitle} id="suggested">
              {t('suggestions.title')}
            </h2>
          </div>
        </div>
        {suggestions?.items.length > 0 ? (
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
        <TextField
          className={styles.search}
          type="search"
          aria-label={t('library.searchLabel')}
          placeholder={t('library.searchPlaceholder')}
          leftIcon={<Icon as={Search} size={15} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectField className={styles.stream} aria-label={t('library.streamLabel')} options={streamOptions} value={stream} onChange={(event) => setStream(event.target.value)} />
      </div>

      <section className={styles.library} aria-labelledby="learning-library">
        <SectionHeading id="learning-library" title={t('library.heading')} description={t('library.count', { count: catalogue.length })} />
        <div className={styles.grid}>
          {courses.length === 0 ? (
            <div className={styles.empty}>
              <EmptyState icon={Search} title={t('library.emptyTitle')} description={t('library.emptyText')} />
            </div>
          ) : (
            courses.map((course) => <CourseCard key={course.id} course={course} />)
          )}
        </div>
      </section>

      <p className={styles.notice}>{t('library.notice')}</p>
    </div>
  )
}
