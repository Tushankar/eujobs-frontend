import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Award, CirclePlay, Layers, Search } from 'lucide-react'
import { Icon, SelectField, TextField } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import SectionHeading from '@/features/recruiter/overview/components/SectionHeading.jsx'
import { useGetCoursesQuery } from '@/features/learning/api.js'
import CourseCard from '../components/CourseCard.jsx'
import styles from './LearningPage.module.css'

/**
 * Recruiter learning (§3.9, M-112): progress stats and the searchable course library. Streams are the courses'
 * categories. In progress = at least one lesson done and not completed (M-110).
 */
export default function LearningPage() {
  const { t } = useTranslation('learning')
  const { data: catalogue = [] } = useGetCoursesQuery()
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
