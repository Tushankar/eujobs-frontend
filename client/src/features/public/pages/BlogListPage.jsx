import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button, Skeleton, SkeletonRegion } from '@/components/ui'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { useGetBlogPostsQuery } from '../api.js'
import PublicShell from '../components/PublicShell.jsx'
import { BlogCard } from '../components/landing/LandingStories.jsx'
import landing from '../components/landing/Landing.module.css'
import styles from '../components/PublicShell.module.css'

/** /blog: published posts in the UI language (English when it has none), newest first, 9 a page (2026-11-13). */
export default function BlogListPage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { currentData: data, isError } = useGetBlogPostsQuery({ language: i18n.language, page })
  useDocumentTitle(t('website:blog.title'))
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const goTo = (next) => setParams(next > 1 ? { page: String(next) } : {})

  return (
    <PublicShell>
      <section className={`${landing.card} ${styles.panel}`} aria-labelledby="blog-title">
        <h1 id="blog-title" className={styles.title}>
          {t('landing:blog.titleLead')} <span className={landing.accent}>{t('landing:blog.titleAccent')}</span>
        </h1>
        <p className={styles.lead}>{t('landing:blog.text')}</p>
        {data?.language && data.language !== i18n.language && <p className={styles.lead}>{t('website:blog.englishOnly')}</p>}

        {isError && <p className={styles.empty}>{t('website:loadError')}</p>}
        {!data && !isError && (
          <SkeletonRegion className={styles.grid}>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} height={420} />
            ))}
          </SkeletonRegion>
        )}
        {data && !data.items.length && <p className={styles.empty}>{t('website:blog.empty')}</p>}
        {data?.items.length > 0 && (
          <div className={styles.grid}>
            {data.items.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        )}
        {pages > 1 && (
          <nav className={styles.pager} aria-label={t('website:blog.pages')}>
            <Button variant="secondary" disabled={page <= 1} onClick={() => goTo(page - 1)}>
              {t('website:blog.newer')}
            </Button>
            <span>{t('website:blog.page', { page, pages })}</span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => goTo(page + 1)}>
              {t('website:blog.older')}
            </Button>
          </nav>
        )}
      </section>
    </PublicShell>
  )
}
