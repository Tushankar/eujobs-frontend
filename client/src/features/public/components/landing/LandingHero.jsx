import { ArrowRight, BriefcaseBusiness, ChevronRight } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BRAND } from '@/app/brand.js'
import avatar1 from '@/assets/landing/avatar-1.webp'
import avatar2 from '@/assets/landing/avatar-2.webp'
import avatar3 from '@/assets/landing/avatar-3.webp'
import BrandLogo from '@/components/layout/BrandLogo.jsx'
import ThemeToggle from '@/components/layout/ThemeToggle.jsx'
import { CompanyLogo, Icon } from '@/components/ui'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import JobSearchForm from './JobSearchForm.jsx'
import styles from './Landing.module.css'
import { NAV, navItemOf } from './siteNav.js'

/** The primary pill with a trailing arrow (Login, Let's Get Started, Join Now); `white` is the outlined variant. */
export function ArrowPill({ to, children, white = false }) {
  return (
    <Link to={to} className={white ? `${styles.pill} ${styles.pillWhite}` : styles.pill}>
      {children}
      <Icon as={ArrowRight} size={16} strokeWidth={2} className={styles.arrow} />
    </Link>
  )
}

/** Three overlapping people (the hero's live count). */
export function AvatarStack({ to, label }) {
  return (
    <Link to={to} className={styles.avatars} aria-label={label}>
      {[avatar1, avatar2, avatar3].map((src) => (
        <img key={src} src={src} alt="" className={styles.avatar} />
      ))}
    </Link>
  )
}

/** The bar of every public page: logo, pill nav (the current page's item filled), theme, Login and sign-up. */
export function SiteHeader({ className = '' }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const current = pathname === '/' ? '/' : navItemOf(pathname)
  return (
    <header className={`${styles.header} ${className}`} data-hero-header>
      <div className={styles.headerInner}>
        <Link to="/" className={styles.brandLink} aria-label={t('landing:nav.home_aria', { brand: BRAND.name })}>
          <BrandLogo height={40} motion="intro" />
        </Link>
        <nav className={styles.navWrap} aria-label={t('landing:nav.label')}>
          <div className={styles.nav}>
            {NAV.map(([to, key]) => (
              <Link key={key} to={to} className={to === current ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem} aria-current={to === current ? 'page' : undefined}>
                {t(`landing:nav.${key}`)}
              </Link>
            ))}
          </div>
        </nav>
        <div className={styles.headerActions}>
          <ThemeToggle className={styles.themeButton} />
          <Link to="/sign-in" className={styles.login}>
            {t('landing:nav.signIn')}
          </Link>
          <Link to="/sign-up" className={`${styles.button} ${styles.signUp}`}>
            {t('landing:hero.join')}
          </Link>
        </div>
      </div>
    </header>
  )
}

// The page's LCP photo lives in public/ with a fixed name so index.html can preload it before any JS runs.
const HERO_PHOTO = '/landing/hero-career.webp'
// A title's trailing "(React, MongoDB, AWS)" makes a long chip; the role name alone reads as a search.
const roleOf = (title) => title.replace(/\s*\(.*\)\s*$/, '')

/** The newest live job as a product card over the photo. */
function NewestJob({ job }) {
  const { t } = useTranslation()
  const text = useJobText()
  const place = text.place(job)
  return (
    <div className={`${styles.floatCard} ${styles.heroJob}`}>
      <div className={styles.heroJobHead}>
        <CompanyLogo name={job.company.name} src={job.company.logoUrl} size={44} className={styles.logoTile} />
        <span className={styles.heroJobText}>
          <span className={styles.heroJobTitle}>{job.title}</span>
          <span className={styles.muted}>{[job.company.name, place].filter(Boolean).join(' · ')}</span>
        </span>
      </div>
      <ul className={styles.chips}>
        {job.workPreference && <li>{t(`enums:workPreference.${job.workPreference}`)}</li>}
        {job.employmentType && <li>{t(`enums:employmentType.${job.employmentType}`)}</li>}
        {job.experienceYears != null && <li>{t('landing:vacancies.years', { count: job.experienceYears })}</li>}
      </ul>
      <Link to={`/jobs?job=${job.id}`} className={`${styles.button} ${styles.heroApply}`}>
        {t('landing:vacancies.apply')}
      </Link>
    </div>
  )
}

/** The next newest job, small, at the photo's top right. */
function RecentJob({ job }) {
  const format = useFormat()
  return (
    <Link to={`/jobs?job=${job.id}`} className={`${styles.floatCard} ${styles.heroRecent}`}>
      <span className={styles.roundIcon} aria-hidden="true">
        <Icon as={BriefcaseBusiness} size={18} />
      </span>
      <span className={styles.heroRecentText}>
        <span className={styles.heroRecentTitle}>{job.title}</span>
        <span className={styles.muted}>{[job.company.name, job.publishedAt && format.relative(job.publishedAt)].filter(Boolean).join(' · ')}</span>
      </span>
    </Link>
  )
}

/**
 * Eyebrow, title, search, the newest roles as quick searches and the live job count; on the right the photo with the
 * two newest jobs as cards. The search opens the public job list (/jobs, owner 2026-11-16).
 */
export default function LandingHero({ data }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const jobs = data?.jobs ?? []
  const roles = [...new Set(jobs.map((job) => roleOf(job.title)))].slice(0, 4)

  function search({ q, location }) {
    const query = new URLSearchParams(Object.entries({ q, location }).filter(([, value]) => value)).toString()
    navigate(query ? `/jobs?${query}` : '/jobs')
  }

  return (
    <section className={styles.hero} id="home">
      <div className={styles.heroGrid} aria-hidden="true" />
      <div className={`${styles.container} ${styles.heroBody}`}>
        <div className={styles.heroText}>
          <Link to="/jobs" className={styles.eyebrowPill} data-hero-fade>
            <span className={styles.eyebrowTag}>{t('landing:hero.eyebrowTag')}</span>
            {t('landing:hero.eyebrow')}
            <Icon as={ChevronRight} size={14} strokeWidth={2} />
          </Link>
          <h1 className={styles.heroTitle}>
            <span className={styles.heroLine}>
              <span data-hero-line>{t('landing:hero.titleLead')}</span>
            </span>
            <span className={`${styles.heroLine} ${styles.heroLineMuted}`}>
              <span data-hero-line>
                <Trans i18nKey="landing:hero.titleWith" values={{ brand: BRAND.name }} components={{ brand: <em className={styles.heroBrand} /> }} />
              </span>
            </span>
          </h1>
          <p className={styles.heroCopy} data-hero-fade>
            {t('landing:hero.text')}
          </p>

          <JobSearchForm onSearch={search} data-hero-fade />

          <div className={styles.heroRoles} data-hero-fade>
            {roles.length > 0 && (
              <>
                <span>{t('landing:hero.latest')}</span>
                {roles.map((role) => (
                  <Link key={role} to={`/jobs?q=${encodeURIComponent(role)}`} className={styles.chipLink}>
                    {role}
                  </Link>
                ))}
              </>
            )}
          </div>

          <div className={styles.heroLive} data-hero-fade>
            <AvatarStack to="/sign-up" label={t('landing:hero.join')} />
            {data?.total != null && (
              <span className={styles.heroLiveText}>
                <span className={styles.heroLiveCount}>
                  <span className={styles.liveDot} aria-hidden="true" />
                  {t('landing:footer.openJobs', { count: data.total })}
                </span>
                <span className={styles.muted}>{t('landing:hero.liveNote')}</span>
              </span>
            )}
          </div>
        </div>

        <div className={styles.heroMedia} data-hero-art>
          <div className={styles.heroFrame}>
            <img src={HERO_PHOTO} alt={t('landing:hero.imageAlt')} className={styles.heroPhoto} fetchPriority="high" />
          </div>
          <div className={styles.heroRecentSlot} data-parallax="-40">
            {jobs[1] && <RecentJob job={jobs[1]} />}
          </div>
          <div className={styles.heroJobSlot} data-parallax="-80">
            {jobs[0] && <NewestJob job={jobs[0]} />}
          </div>
        </div>
      </div>
    </section>
  )
}

