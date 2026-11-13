// The Figma blog cards use Montserrat (title) and Open Sans (author, date, button).
import '@fontsource/montserrat/600.css'
import '@fontsource/open-sans/400.css'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import blogGlowGreen from '@/assets/landing/blog-glow-green.svg'
import blogGlowOrange from '@/assets/landing/blog-glow-orange.svg'
import blogPattern from '@/assets/landing/blog-pattern.svg?raw'
import jobsGlowBlue from '@/assets/landing/jobs-glow-blue.svg'
import jobsGlowGreen from '@/assets/landing/jobs-glow-green.svg'
import reviewsCircuit from '@/assets/landing/reviews-circuit.svg?raw'
import { Icon } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import InlineSvg from './InlineSvg.jsx'
import styles from './Landing.module.css'

const PER_PAGE = 2
const initials = (name) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

/** 1–5 stars in the Figma yellow; the rest of the five are grey. */
function Stars({ rating }) {
  const { t } = useTranslation()
  return (
    <p className={styles.stars} role="img" aria-label={t('landing:reviews.rating', { value: rating })}>
      {'★'.repeat(rating)}
      <span className={styles.starsOff}>{'★'.repeat(5 - rating)}</span>
    </p>
  )
}

/**
 * Figma 396:14650: approved user reviews (owner 2026-11-13), two at a time with arrows when there are more. The
 * section is left out while no review is approved.
 */
export function Testimonials({ reviews }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  if (!reviews?.length) return null
  const pages = Math.ceil(reviews.length / PER_PAGE)
  const shown = reviews.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)

  return (
    <section className={`${styles.card} ${styles.section} ${styles.reviews}`} aria-labelledby="reviews-title">
      <InlineSvg svg={reviewsCircuit} className={styles.reviewsCircuit} motion="circuit" />
      <img src={jobsGlowGreen} alt="" loading="lazy" className={styles.glow} style={{ left: -59, top: -48, width: 1113 }} aria-hidden="true" data-glow />
      <img src={jobsGlowBlue} alt="" loading="lazy" className={styles.glow} style={{ left: 217, top: -61, width: 1049 }} aria-hidden="true" data-glow />
      <div className={styles.sectionHead} data-reveal>
        <h2 id="reviews-title" className={styles.sectionTitle}>
          {t('landing:reviews.titleLead')} <span className={styles.accent}>{t('landing:reviews.titleAccent')}</span>
        </h2>
        <p className={styles.sectionText}>{t('landing:reviews.text')}</p>
      </div>
      <div key={page} className={styles.reviewGrid} data-stagger>
        {shown.map((review) => (
          <article key={review.id} className={styles.review}>
            <Stars rating={review.rating} />
            <p className={styles.reviewText}>“{review.text}”</p>
            <div className={styles.reviewAuthor}>
              <span className={styles.reviewInitials} aria-hidden="true">
                {initials(review.name)}
              </span>
              <span>
                <strong className={styles.reviewName}>{review.name}</strong>
                {review.title && <span className={styles.reviewTitle}>{review.title}</span>}
              </span>
            </div>
          </article>
        ))}
      </div>
      {pages > 1 && (
        <div className={styles.reviewsNav}>
          <button type="button" className={styles.roundButton} onClick={() => setPage((page - 1 + pages) % pages)} aria-label={t('landing:reviews.previous')}>
            <Icon as={ChevronLeft} size={18} />
          </button>
          <span className={styles.reviewsPage} aria-live="polite">
            {t('landing:reviews.page', { page: page + 1, pages })}
          </span>
          <button type="button" className={styles.roundButton} onClick={() => setPage((page + 1) % pages)} aria-label={t('landing:reviews.next')}>
            <Icon as={ChevronRight} size={18} />
          </button>
        </div>
      )}
    </section>
  )
}

/** One post card of Figma 396:14823 (also the /blog list); `active` is the filled first card of the design. */
export function BlogCard({ post, active = false }) {
  const { t } = useTranslation()
  const format = useFormat()
  return (
    <article className={active ? `${styles.blogCard} ${styles.blogCardActive}` : styles.blogCard}>
      <div className={styles.blogImage}>{post.coverUrl && <img src={post.coverUrl} alt="" loading="lazy" />}</div>
      <p className={styles.blogMeta}>
        <span>{post.author ?? t('landing:blog.team')}</span>
        {post.publishedAt && <time dateTime={post.publishedAt}>{format.date(post.publishedAt, { day: '2-digit', month: 'long' })}</time>}
      </p>
      <h3 className={styles.blogTitle}>
        <Link to={`/blog/${post.slug}`}>{post.title}</Link>
      </h3>
      <Link to={`/blog/${post.slug}`} className={styles.blogButton} tabIndex={-1} aria-hidden="true">
        {t('landing:blog.read')}
      </Link>
    </article>
  )
}

/** Figma 396:14813: the three newest posts in the visitor's language (English when it has none); left out while empty. */
export function Blogs({ posts }) {
  const { t } = useTranslation()
  if (!posts?.length) return null
  return (
    <section id="blog" className={`${styles.card} ${styles.section} ${styles.blogSection} ${styles.anchor}`} aria-labelledby="blog-title">
      <InlineSvg svg={blogPattern} className={styles.blogPattern} motion="pattern" />
      <img src={blogGlowOrange} alt="" loading="lazy" className={styles.glow} style={{ left: -59, top: 192, width: 1062 }} aria-hidden="true" data-glow />
      <img src={blogGlowGreen} alt="" loading="lazy" className={styles.glow} style={{ left: 106, top: 192, width: 1062 }} aria-hidden="true" data-glow />
      <div className={styles.sectionHead} data-reveal>
        <h2 id="blog-title" className={styles.sectionTitle}>
          {t('landing:blog.titleLead')} <span className={styles.accent}>{t('landing:blog.titleAccent')}</span>
        </h2>
        <p className={styles.sectionText}>{t('landing:blog.text')}</p>
      </div>
      <div className={styles.blogGrid} data-stagger>
        {posts.map((post, index) => (
          <BlogCard key={post.id} post={post} active={index === 0} />
        ))}
      </div>
    </section>
  )
}
