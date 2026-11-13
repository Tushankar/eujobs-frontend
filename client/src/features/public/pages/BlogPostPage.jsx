import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { errorCode } from '@/app/api.js'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetBlogPostQuery } from '../api.js'
import PublicShell from '../components/PublicShell.jsx'
import landing from '../components/landing/Landing.module.css'
import styles from '../components/PublicShell.module.css'

/** /blog/:slug: one published post; its HTML is the server's sanitised Markdown (2026-11-13). */
export default function BlogPostPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const { slug } = useParams()
  const { currentData: post, error } = useGetBlogPostQuery(slug)
  useDocumentTitle(post?.title ?? t('website:blog.title'))

  return (
    <PublicShell>
      <section className={`${landing.card} ${styles.panel}`}>
        <article className={styles.article}>
          <Link to="/blog" className={styles.back}>
            <Icon as={ArrowLeft} size={14} />
            {t('website:blog.back')}
          </Link>
          {error && <p className={styles.empty}>{t(errorCode(error) === 'NOT_FOUND' ? 'website:blog.missing' : 'website:loadError')}</p>}
          {!post && !error && (
            <SkeletonRegion>
              <Skeleton height={44} width="80%" />
              <Skeleton height={360} />
            </SkeletonRegion>
          )}
          {post && (
            <>
              <h1 className={styles.title}>{post.title}</h1>
              <p className={styles.meta}>
                <span>{post.author ?? t('landing:blog.team')}</span>
                {post.publishedAt && (
                  <time dateTime={post.publishedAt}>{format.date(post.publishedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</time>
                )}
              </p>
              {post.coverUrl && <img src={post.coverUrl} alt="" className={styles.cover} />}
              <p className={styles.excerpt}>{post.excerpt}</p>
              <div className={styles.body} lang={post.language} dangerouslySetInnerHTML={{ __html: post.html }} />
            </>
          )}
        </article>
      </section>
    </PublicShell>
  )
}
