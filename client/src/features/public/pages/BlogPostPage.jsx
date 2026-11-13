import { ArrowLeft, Check, Clock, Link2, Mail } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { errorCode } from '@/app/api.js'
import { BRAND } from '@/app/brand.js'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetBlogPostQuery, useGetBlogPostsQuery } from '../api.js'
import PublicShell from '../components/PublicShell.jsx'
import { ArrowPill } from '../components/landing/LandingHero.jsx'
import landing from '../components/landing/Landing.module.css'
import styles from './BlogPostPage.module.css'

const WORDS_PER_MINUTE = 220

/* Brand marks lucide no longer ships (Simple Icons, CC0). */
const LINKEDIN =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'
const X_MARK = 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z'
const Mark = ({ d }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={d} fill="currentColor" />
  </svg>
)

/** The post's HTML with an id on every h2 (for the contents list), its headings and its reading time. */
function useArticle(html) {
  return useMemo(() => {
    if (!html) return null
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const headings = [...doc.querySelectorAll('h2')].map((heading, index) => {
      heading.id = `section-${index + 1}`
      return { id: heading.id, text: heading.textContent }
    })
    const words = doc.body.textContent.trim().split(/\s+/).length
    return { html: doc.body.innerHTML, headings, minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)) }
  }, [html])
}

/** Copy link, LinkedIn, X and email; the links open the network's own share page. */
function Share({ title, vertical = false }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const url = window.location.href
  const encoded = encodeURIComponent(url)

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={vertical ? `${styles.share} ${styles.shareVertical}` : styles.share} aria-label={t('website:post.share')} role="group">
      <button type="button" className={styles.shareButton} onClick={copy} aria-label={t('website:post.copy')} title={t('website:post.copy')}>
        <Icon as={copied ? Check : Link2} size={15} />
      </button>
      <a className={styles.shareButton} href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn">
        <Mark d={LINKEDIN} />
      </a>
      <a className={styles.shareButton} href={`https://x.com/intent/post?url=${encoded}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer" aria-label="X" title="X">
        <Mark d={X_MARK} />
      </a>
      <a className={styles.shareButton} href={`mailto:?subject=${encodeURIComponent(title)}&body=${encoded}`} aria-label={t('website:post.email')} title={t('website:post.email')}>
        <Icon as={Mail} size={15} />
      </a>
      {copied && (
        <span className={styles.copied} role="status">
          {t('website:post.copied')}
        </span>
      )}
    </div>
  )
}

/** Up to three other posts of the same language list, as related reading. */
function Related({ post }) {
  const { t, i18n } = useTranslation()
  const format = useFormat()
  const { data } = useGetBlogPostsQuery({ language: i18n.language, page: 1 })
  const others = (data?.items ?? []).filter((item) => item.id !== post.id).slice(0, 3)
  if (!others.length) return null
  return (
    <section className={`${landing.card} ${styles.related}`} aria-labelledby="related-title">
      <div className={styles.relatedHead}>
        <h2 id="related-title" className={styles.relatedTitle}>
          {t('website:post.relatedLead')} <span className={landing.accent}>{t('website:post.relatedAccent')}</span>
        </h2>
        <Link to="/blog" className={styles.allLink}>
          {t('website:blog.back')} →
        </Link>
      </div>
      <div className={styles.relatedGrid}>
        {others.map((item) => (
          <article key={item.id} className={styles.relatedCard}>
            <div className={styles.relatedImage}>{item.coverUrl && <img src={item.coverUrl} alt="" loading="lazy" />}</div>
            <p className={styles.relatedMeta}>{item.publishedAt && format.date(item.publishedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h3 className={styles.relatedCardTitle}>
              <Link to={`/blog/${item.slug}`}>{item.title}</Link>
            </h3>
            <p className={styles.relatedExcerpt}>{item.excerpt}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

/**
 * /blog/:slug (2026-11-13; owner: "premium, like professional company blogs"): reading progress, the eyebrow, title,
 * deck and author line, a wide cover, the article with a sticky contents list and share rail, a call to action and
 * related posts. The HTML is the server's sanitised Markdown.
 */
export default function BlogPostPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const { slug } = useParams()
  const { currentData: post, error } = useGetBlogPostQuery(slug)
  const article = useArticle(post?.html)
  useDocumentTitle(post?.title ?? t('website:blog.title'))
  const author = post?.author ?? t('landing:blog.team')
  const initials = author
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <PublicShell>
      <span className={styles.progress} aria-hidden="true" />
      {error ? (
        <section className={`${landing.card} ${styles.header}`}>
          <Link to="/blog" className={styles.back}>
            <Icon as={ArrowLeft} size={14} />
            {t('website:blog.back')}
          </Link>
          <p className={styles.missing}>{t(errorCode(error) === 'NOT_FOUND' ? 'website:blog.missing' : 'website:loadError')}</p>
        </section>
      ) : !post || !article ? (
        <section className={`${landing.card} ${styles.header}`}>
          <SkeletonRegion>
            <Skeleton width={160} />
            <Skeleton height={56} width="80%" />
            <Skeleton height={420} />
          </SkeletonRegion>
        </section>
      ) : (
        <>
          <article className={`${landing.card} ${styles.post}`}>
            <header className={styles.header}>
              <p className={styles.eyebrow}>
                <Link to="/blog">{t('website:post.eyebrow', { brand: BRAND.name })}</Link>
                {post.publishedAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <time dateTime={post.publishedAt}>{format.date(post.publishedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</time>
                  </>
                )}
              </p>
              <h1 className={styles.title}>{post.title}</h1>
              <p className={styles.deck}>{post.excerpt}</p>
              <div className={styles.byline}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials}
                </span>
                <span className={styles.bylineText}>
                  <strong>{author}</strong>
                  <span>
                    <Icon as={Clock} size={13} />
                    {t('website:post.minutes', { count: article.minutes })}
                  </span>
                </span>
                <Share title={post.title} />
              </div>
            </header>

            {post.coverUrl && (
              <figure className={styles.cover}>
                <img src={post.coverUrl} alt="" />
              </figure>
            )}

            <div className={styles.layout}>
              <aside className={styles.rail}>
                <Share title={post.title} vertical />
              </aside>
              <div className={styles.body} lang={post.language} dangerouslySetInnerHTML={{ __html: article.html }} />
              {article.headings.length > 1 && (
                <nav className={styles.toc} aria-label={t('website:post.contents')}>
                  <p className={styles.tocTitle}>{t('website:post.contents')}</p>
                  <ol>
                    {article.headings.map((heading) => (
                      <li key={heading.id}>
                        <a href={`#${heading.id}`}>{heading.text}</a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
            </div>

            <aside className={styles.cta}>
              <div>
                <p className={styles.ctaTitle}>{t('website:post.ctaTitle')}</p>
                <p className={styles.ctaText}>{t('website:post.ctaText')}</p>
              </div>
              <div className={styles.ctaActions}>
                <ArrowPill to="/sign-up" white>
                  {t('website:post.ctaJoin')}
                </ArrowPill>
                <Link to="/#jobs" className={styles.ctaLink}>
                  {t('website:post.ctaJobs')} →
                </Link>
              </div>
            </aside>
          </article>
          <Related post={post} />
        </>
      )}
    </PublicShell>
  )
}
