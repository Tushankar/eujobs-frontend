import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import { SectionHead } from './LandingSections.jsx'
import styles from './Landing.module.css'

const PER_PAGE = 3
const initials = (name) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

/** 1–5 gold stars; the rest of the five are faint. */
function Stars({ rating }) {
  const { t } = useTranslation()
  return (
    <p className={styles.stars} role="img" aria-label={t('landing:reviews.rating', { value: rating })}>
      {'★'.repeat(rating)}
      <span className={styles.starsOff}>{'★'.repeat(5 - rating)}</span>
    </p>
  )
}

/** Approved user reviews (owner 2026-11-13), three at a time with arrows when there are more; left out while none. */
export function Testimonials({ reviews }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  if (!reviews?.length) return null
  const pages = Math.ceil(reviews.length / PER_PAGE)
  const shown = reviews.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)

  return (
    <section className={`${styles.container} ${styles.section} ${styles.reviews}`} aria-labelledby="reviews-title">
      <SectionHead id="reviews-title" eyebrow={t('landing:reviews.eyebrow')} lead={t('landing:reviews.titleLead')} accent={t('landing:reviews.titleAccent')} text={t('landing:reviews.text')}>
        {pages > 1 && (
          <div className={styles.reviewsNav}>
            <span className={styles.muted} aria-live="polite">
              {t('landing:reviews.page', { page: page + 1, pages })}
            </span>
            <button type="button" className={styles.roundButton} onClick={() => setPage((page - 1 + pages) % pages)} aria-label={t('landing:reviews.previous')}>
              <Icon as={ArrowLeft} size={16} strokeWidth={2} />
            </button>
            <button type="button" className={`${styles.roundButton} ${styles.roundButtonFilled}`} onClick={() => setPage((page + 1) % pages)} aria-label={t('landing:reviews.next')}>
              <Icon as={ArrowRight} size={16} strokeWidth={2} />
            </button>
          </div>
        )}
      </SectionHead>
      <div key={page} className={styles.reviewGrid} data-stagger>
        {shown.map((review) => (
          <article key={review.id} className={`${styles.tile} ${styles.review}`}>
            <Stars rating={review.rating} />
            <blockquote className={styles.reviewText}>“{review.text}”</blockquote>
            <footer className={styles.reviewAuthor}>
              <span className={styles.reviewInitials} aria-hidden="true">
                {initials(review.name)}
              </span>
              <span>
                <strong className={styles.reviewName}>{review.name}</strong>
                {review.title && <span className={styles.muted}>{review.title}</span>}
              </span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  )
}

/** One post card (the landing page and the /blog list): cover, author and date, title, read link. */
export function BlogCard({ post }) {
  const { t } = useTranslation()
  const format = useFormat()
  return (
    <article className={`${styles.tile} ${styles.blogCard}`}>
      <div className={styles.blogImage}>{post.coverUrl && <img src={post.coverUrl} alt="" loading="lazy" />}</div>
      <div className={styles.blogBody}>
        <p className={styles.blogMeta}>
          {[post.author ?? t('landing:blog.team'), post.publishedAt && format.date(post.publishedAt, { day: '2-digit', month: 'long' })].filter(Boolean).join(' · ')}
        </p>
        <h3 className={styles.blogTitle}>
          <Link to={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        <span className={styles.blogRead} aria-hidden="true">
          {t('landing:blog.read')}
          <Icon as={ArrowRight} size={14} strokeWidth={2} />
        </span>
      </div>
    </article>
  )
}

/** The three newest posts in the visitor's language (English when it has none); left out while empty. */
export function Blogs({ posts }) {
  const { t } = useTranslation()
  if (!posts?.length) return null
  return (
    <section id="blog" className={`${styles.container} ${styles.section} ${styles.blogSection} ${styles.anchor}`} aria-labelledby="blog-title">
      <SectionHead id="blog-title" eyebrow={t('landing:nav.blog')} lead={t('landing:blog.titleLead')} accent={t('landing:blog.titleAccent')} text={t('landing:blog.text')}>
        <Link to="/blog" className={`${styles.button} ${styles.outline}`}>
          {t('landing:blog.all')}
          <Icon as={ArrowRight} size={14} strokeWidth={2} />
        </Link>
      </SectionHead>
      <div className={styles.blogGrid} data-stagger>
        {posts.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  )
}
