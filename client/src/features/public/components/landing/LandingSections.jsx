import { Activity, ArrowRight, ArrowUp, ArrowUpRight, Bell, Briefcase, Building2, Clock, FileCheck, FileText, Globe, House, MapPin, Minus, Plus, ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BRAND } from '@/app/brand.js'
import ctaPhoto from '@/assets/landing/cta-photo.webp'
import abx from '@/assets/landing/logo-abx.svg'
import aces from '@/assets/landing/logo-aces.svg'
import cubana from '@/assets/landing/logo-cubana.svg'
import delta from '@/assets/landing/logo-delta.svg'
import egyptair from '@/assets/landing/logo-egyptair.svg'
import viking from '@/assets/landing/logo-viking.svg'
import westjet from '@/assets/landing/logo-westjet.svg'
import stepsPhoto from '@/assets/landing/steps-photo.webp'
import BrandLogo from '@/components/layout/BrandLogo.jsx'
import { CompanyLogo, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { useSubscribeNewsletterMutation } from '../../api.js'
import { useCountUp } from './useLandingMotion.js'
import styles from './Landing.module.css'

/** Eyebrow, a title whose last words are in the brand blue, and an optional line of copy. */
export function SectionHead({ id, eyebrow, lead, accent, text, center = false, children }) {
  return (
    <div className={center ? `${styles.sectionHead} ${styles.sectionHeadCenter}` : styles.sectionHead}>
      <div className={styles.sectionIntro} data-reveal>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2 id={id} className={styles.sectionTitle}>
          {lead} <span className={styles.accent}>{accent}</span>
        </h2>
        {text && <p className={styles.sectionText}>{text}</p>}
      </div>
      {children}
    </div>
  )
}

/** The owner kept the airline logos of the design (2026-11-11); in dark they turn white and quiet. */
export function TrustedStrip() {
  const { t } = useTranslation()
  return (
    <section className={styles.band} aria-labelledby="trusted-title">
      <div className={`${styles.container} ${styles.trusted}`}>
        <h2 id="trusted-title" className={styles.trustedTitle}>
          {t('landing:trusted.title')}
        </h2>
        <div className={styles.trustedLogos} data-stagger>
          <img src={delta} alt="Delta" />
          <img src={egyptair} alt="EgyptAir" />
          <img src={viking} alt="Viking" />
          <img src={westjet} alt="WestJet" />
          <img src={aces} alt="ACES" />
          <img src={abx} alt="ABX Air" />
          <img src={cubana} alt="Cubana" />
        </div>
      </div>
    </section>
  )
}

/* The three work modes and three employment types, with live open-job counts; grey line icons. */
const CATEGORIES = [
  { group: 'workPreference', value: 'remote', icon: Globe },
  { group: 'workPreference', value: 'hybrid', icon: House },
  { group: 'workPreference', value: 'on_site', icon: Building2 },
  { group: 'employmentType', value: 'full_time', icon: Briefcase },
  { group: 'employmentType', value: 'part_time', icon: Clock },
  { group: 'employmentType', value: 'contract', icon: FileText },
]

/** Every card opens the public job list on its own tab (/jobs, owner 2026-11-16). */
export function Categories({ counts }) {
  const { t } = useTranslation()
  return (
    <section className={`${styles.container} ${styles.section} ${styles.categoriesSection}`} aria-labelledby="categories-title">
      <SectionHead
        id="categories-title"
        eyebrow={t('landing:categories.eyebrow')}
        lead={t('landing:categories.titleLead')}
        accent={t('landing:categories.titleAccent')}
      >
        <p className={`${styles.sectionText} ${styles.sectionAside}`}>
          {t('landing:categories.text')}
        </p>
      </SectionHead>
      <div className={styles.categories} data-stagger>
        {CATEGORIES.map(({ group, value, icon }) => (
          <Link key={value} to={`/jobs?${group}=${value}`} className={`${styles.tile} ${styles.category}`}>
            <span className={styles.lineIcon} data-svg="icon">
              <Icon as={icon} size={28} strokeWidth={1.5} />
            </span>
            <h3 className={styles.categoryName}>{t(`enums:${group}.${value}`)}</h3>
            <p className={styles.categoryText}>{t(`landing:categories.${value}`)}</p>
            <span className={styles.categoryFoot}>
              {counts ? <CategoryCount value={counts[group][value]} /> : <Skeleton width={90} />}
              <Icon as={ArrowUpRight} size={18} strokeWidth={1.8} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** "7 open jobs", counting up when it scrolls into view. */
function CategoryCount({ value }) {
  const { t } = useTranslation()
  const ref = useRef(null)
  useCountUp(ref, value, (count) => t('landing:categories.jobs', { count }))
  return <span ref={ref}>{t('landing:categories.jobs', { count: value })}</span>
}

const STEPS = ['register', 'search', 'resume', 'apply']

/** How it works ("About Us" in the nav): the photo with the CV card, and the four numbered steps. */
export function Steps() {
  const { t } = useTranslation()
  return (
    <section id="about" className={`${styles.container} ${styles.section} ${styles.split} ${styles.anchor}`} aria-labelledby="steps-title">
      <div className={styles.stepsMedia}>
        <img src={stepsPhoto} alt={t('landing:steps.imageAlt')} className={styles.stepsPhoto} loading="lazy" data-wipe />
        <div className={`${styles.floatCard} ${styles.cvCard}`} data-parallax="-30">
          <div className={styles.cvRow}>
            <span className={styles.squareIcon} aria-hidden="true">
              <Icon as={FileCheck} size={18} />
            </span>
            <span className={styles.cvText}>
              <span className={styles.cvTitle}>{t('landing:steps.cvTitle')}</span>
              <span className={styles.muted}>{t('landing:steps.cvText')}</span>
            </span>
          </div>
          <span className={styles.cvBar} aria-hidden="true" />
        </div>
      </div>
      <div className={styles.stepsBody}>
        <SectionHead id="steps-title" eyebrow={t('landing:steps.eyebrow')} lead={t('landing:steps.titleLead')} accent={t('landing:steps.titleAccent')} text={t('landing:steps.text')} />
        <ol className={styles.stepList} data-stagger>
          {STEPS.map((key, index) => (
            <li key={key} className={styles.step}>
              <span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
              <span>
                <h3 className={styles.stepTitle}>{t(`landing:steps.${key}Title`)}</h3>
                <p className={styles.stepText}>{t(`landing:steps.${key}Text`)}</p>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** One of the newest jobs: company logo, title, place, mode, type, years, age and Apply. */
function JobCard({ job }) {
  const { t } = useTranslation()
  const format = useFormat()
  const text = useJobText()
  const place = text.place(job)
  return (
    <article className={`${styles.tile} ${styles.job}`}>
      <div className={styles.jobTop}>
        <CompanyLogo name={job.company.name} src={job.company.logoUrl} size={48} className={styles.logoTile} />
        <div className={styles.jobHead}>
          <h3 className={styles.jobTitle}>
            <Link to={`/jobs?job=${job.id}`}>{job.title}</Link>
          </h3>
          <p className={styles.jobCompany}>{job.company.name}</p>
        </div>
      </div>
      <ul className={styles.chips}>
        {place && (
          <li>
            <Icon as={MapPin} size={12} strokeWidth={2} />
            {place}
          </li>
        )}
        {job.workPreference && job.country !== 'REMOTE' && <li>{t(`enums:workPreference.${job.workPreference}`)}</li>}
        {job.employmentType && <li>{t(`enums:employmentType.${job.employmentType}`)}</li>}
        {job.experienceYears != null && <li>{t('landing:vacancies.years', { count: job.experienceYears })}</li>}
      </ul>
      <div className={styles.jobBottom}>
        {job.publishedAt ? (
          <time className={styles.muted} dateTime={job.publishedAt}>
            {format.relative(job.publishedAt)}
          </time>
        ) : (
          <span />
        )}
        <Link to={`/jobs?job=${job.id}`} className={`${styles.button} ${styles.outline} ${styles.small}`} tabIndex={-1}>
          {t('landing:vacancies.apply')}
          <Icon as={ArrowRight} size={14} strokeWidth={2} />
        </Link>
      </div>
    </article>
  )
}

const WORK_TYPES = ['remote', 'hybrid', 'on_site']

/** The newest published jobs, filtered by work type; `jobs` is null while they load (skeleton cards). */
export function Vacancies({ jobs }) {
  const { t } = useTranslation()
  const [type, setType] = useState(null)
  // Only the work types that some of these jobs have get a tab.
  const types = WORK_TYPES.filter((value) => jobs?.some((job) => job.workPreference === value))
  const shown = jobs?.filter((job) => !type || job.workPreference === type)
  return (
    <section id="jobs" className={`${styles.band} ${styles.anchor}`} aria-labelledby="jobs-title">
      <div className={`${styles.container} ${styles.section}`}>
        <SectionHead id="jobs-title" eyebrow={t('landing:vacancies.eyebrow')} lead={t('landing:vacancies.titleLead')} accent={t('landing:vacancies.titleAccent')} text={t('landing:vacancies.text')}>
          {types.length > 1 && (
            <div className={styles.segments} role="tablist" aria-label={t('landing:vacancies.filter')} data-reveal>
              {[null, ...types].map((value) => (
                <button key={value ?? 'all'} type="button" role="tab" aria-selected={type === value} className={styles.segment} onClick={() => setType(value)}>
                  {value ? t(`enums:workPreference.${value}`) : t('landing:vacancies.allTypes')}
                </button>
              ))}
            </div>
          )}
        </SectionHead>
        {!jobs ? (
          <SkeletonRegion className={styles.jobs}>
            {[0, 1, 2].map((index) => (
              <div key={index} className={`${styles.tile} ${styles.job}`}>
                <Skeleton width="60%" />
                <Skeleton width="40%" />
                <Skeleton width="80%" />
              </div>
            ))}
          </SkeletonRegion>
        ) : jobs.length ? (
          <div key={type ?? 'all'} className={styles.jobs} data-stagger>
            {shown.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>{t('landing:vacancies.empty')}</p>
        )}
        {jobs?.length > 0 && (
          <Link to="/jobs" className={`${styles.button} ${styles.outline} ${styles.centered}`}>
            {t('landing:vacancies.all')}
            <Icon as={ArrowRight} size={16} strokeWidth={2} />
          </Link>
        )}
      </div>
    </section>
  )
}

const FEATURES = [
  ['live', Activity],
  ['alerts', Bell],
  ['trust', ShieldCheck],
]

/** The career band: copy and a sign-up button, and three feature rows. */
export function CareerBanner() {
  const { t } = useTranslation()
  return (
    <section className={`${styles.container} ${styles.careerSection}`} aria-labelledby="career-title">
      <div className={`${styles.tile} ${styles.career}`}>
        <div className={styles.careerCopy} data-reveal>
          <h2 id="career-title" className={styles.careerTitle}>
            {t('landing:career.title')}
          </h2>
          <p className={styles.sectionText}>{t('landing:career.text')}</p>
          <Link to="/sign-up" className={styles.button}>
            {t('landing:hero.start')}
          </Link>
        </div>
        <ul className={styles.features} data-stagger>
          {FEATURES.map(([key, glyph]) => (
            <li key={key}>
              <span className={styles.lineIcon} data-svg="icon">
                <Icon as={glyph} size={22} />
              </span>
              <span>
                <strong>{t(`landing:career.${key}Title`)}</strong>
                <span className={styles.muted}>{t(`landing:career.${key}Text`)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** The candidate help FAQs, the first one open; the contact card shows when the site has an address or a phone. */
export function Faq({ faqs, contact }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(0)
  if (!faqs.length) return null
  const reach = contact?.email ? `mailto:${contact.email}` : contact?.phone && `tel:${contact.phone.replace(/[^\d+]/g, '')}`
  return (
    <section id="faq" className={`${styles.container} ${styles.section} ${styles.faq} ${styles.anchor}`} aria-labelledby="faq-title">
      <div className={styles.faqIntro}>
        <SectionHead id="faq-title" eyebrow={t('landing:faq.eyebrow')} lead={t('landing:faq.titleLead')} accent={t('landing:faq.titleAccent')} text={t('landing:faq.text')} />
        {reach && (
          <div className={`${styles.tile} ${styles.faqContact}`} data-reveal>
            <span>
              <strong>{t('landing:faq.contactTitle')}</strong>
              <span className={styles.muted}>{t('landing:faq.contactText')}</span>
            </span>
            <a href={reach} className={`${styles.button} ${styles.outline} ${styles.small}`}>
              {t('landing:nav.contact')}
            </a>
          </div>
        )}
      </div>
      <div className={styles.faqList} data-stagger>
        {faqs.map((faq, index) => {
          const expanded = open === index
          return (
            <div key={faq.id} className={expanded ? `${styles.faqItem} ${styles.faqOpen}` : styles.faqItem}>
              <button type="button" className={styles.faqButton} aria-expanded={expanded} aria-controls={`faq-${faq.id}`} onClick={() => setOpen(expanded ? -1 : index)}>
                {faq.question}
                <Icon as={expanded ? Minus : Plus} size={20} strokeWidth={2} />
              </button>
              {expanded && (
                <p id={`faq-${faq.id}`} className={styles.faqAnswer}>
                  {faq.answer}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** The closing card: copy with Join Now and the recruiters' sign-up, and a photo. */
export function CallToAction() {
  const { t } = useTranslation()
  return (
    <section className={`${styles.container} ${styles.ctaSection}`} aria-labelledby="cta-title">
      <div className={`${styles.tile} ${styles.cta}`}>
        <div className={styles.ctaCopy} data-reveal>
          <h2 id="cta-title" className={styles.ctaTitle}>
            {t('landing:cta.title')}
          </h2>
          <p className={styles.ctaText}>{t('landing:cta.text')}</p>
          <div className={styles.ctaActions}>
            <Link to="/sign-up" className={`${styles.button} ${styles.large}`}>
              {t('landing:cta.join')}
            </Link>
            <Link to="/recruiter/sign-up" className={`${styles.button} ${styles.outline} ${styles.large}`}>
              {t('landing:footer.recruiters')}
            </Link>
          </div>
        </div>
        <div className={styles.ctaMedia}>
          <img src={ctaPhoto} alt={t('landing:cta.imageAlt')} className={styles.ctaPhoto} loading="lazy" data-zoom />
        </div>
      </div>
    </section>
  )
}

const FOOTER_GROUPS = [
  { title: 'explore', links: [['/#about', 'about'], ['/#jobs', 'jobs'], ['/#pricing', 'pricing'], ['/blog', 'blog'], ['/#faq', 'faq']] },
  { title: 'account', links: [['/sign-in', 'signIn'], ['/sign-up', 'signUp'], ['/recruiter/sign-in', 'recruiters']] },
  { title: 'legal', links: [['/legal/privacy', 'privacy'], ['/legal/terms', 'terms'], ['/legal/imprint', 'imprint']] },
]
// Line glyphs of the three networks (lucide has no brand icons).
const SOCIALS = {
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  facebook: <path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z" />,
}
const toTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })

/** The newsletter double opt-in (2026-11-13); the answer never says whether the address was listed. */
function Newsletter() {
  const { t, i18n } = useTranslation()
  const errorText = useErrorText()
  const [subscribe, { isLoading, isSuccess }] = useSubscribeNewsletterMutation()
  const form = useFormState({ email: '' })

  function submit(event) {
    event.preventDefault()
    form.run({ email: check.email(form.values.email) }, () => subscribe({ email: form.values.email.trim(), language: i18n.language }).unwrap())
  }

  const error = form.errors.email ? errorText.field('email', form.errors.email) : form.failure && errorText.code(form.failure)
  return (
    <div className={styles.newsletter}>
      <p className={styles.newsletterTitle}>
        {t('landing:newsletter.titleLead')} {t('landing:newsletter.titleRest')} {t('landing:newsletter.titleAccent')}
      </p>
      {isSuccess ? (
        <p className={styles.newsletterDone} role="status">
          {t('landing:newsletter.sent')}
        </p>
      ) : (
        <form onSubmit={submit} noValidate aria-label={t('landing:newsletter.label')}>
          <div className={styles.newsletterField}>
            <input
              type="email"
              autoComplete="email"
              value={form.values.email}
              onChange={(event) => form.set('email', event.target.value)}
              placeholder={t('landing:newsletter.email')}
              aria-label={t('landing:newsletter.email')}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? 'newsletter-error' : 'newsletter-note'}
            />
            <button type="submit" disabled={isLoading}>
              {t('landing:newsletter.subscribe')}
            </button>
          </div>
          {error ? (
            <p id="newsletter-error" className={styles.newsletterError} role="alert">
              {error}
            </p>
          ) : (
            <p id="newsletter-note" className={styles.newsletterNote}>
              {t('landing:newsletter.note')}
            </p>
          )}
        </form>
      )}
    </div>
  )
}

/**
 * The site footer (landing and every public page): logo, blurb, the live open-job count and the newsletter; the
 * Explore, Account and Legal links; the contact details and social links from the server config (left out while
 * empty); copyright and back to top.
 */
export function Footer({ total, contact }) {
  const { t } = useTranslation()
  const [year] = useState(() => new Date().getFullYear())
  const socials = Object.keys(SOCIALS).filter((key) => contact?.social[key])
  const hasContact = contact?.email || contact?.phone || socials.length > 0
  return (
    <footer id="contact" className={`${styles.band} ${styles.footer} ${styles.anchor}`}>
      <div className={styles.container}>
        <div className={styles.footerTop} data-reveal>
          <div className={styles.footerBrand}>
            <Link to="/" aria-label={t('landing:nav.home_aria', { brand: BRAND.name })} className={styles.brandLink}>
              <BrandLogo height={40} />
            </Link>
            <p className={styles.footerBlurb}>{t('landing:footer.blurb')}</p>
            {total != null && (
              <p className={styles.footerLive}>
                <span className={styles.liveDot} aria-hidden="true" />
                {t('landing:footer.openJobs', { count: total })}
              </p>
            )}
            <Newsletter />
          </div>
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} className={styles.footerColumn} aria-label={t(`landing:footer.${group.title}`)}>
              <h3 className={styles.footerHeading}>{t(`landing:footer.${group.title}`)}</h3>
              {group.links.map(([to, key]) => (
                <Link key={key} to={to}>
                  {t(`landing:footer.${key}`)}
                </Link>
              ))}
            </nav>
          ))}
          {hasContact && (
            <div className={styles.footerColumn}>
              <h3 className={styles.footerHeading}>{t('landing:footer.contact')}</h3>
              {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
              {contact.phone && <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a>}
              {socials.length > 0 && (
                <ul className={styles.socials} aria-label={t('landing:footer.social')}>
                  {socials.map((key) => (
                    <li key={key}>
                      <a href={contact.social[key]} target="_blank" rel="noopener noreferrer" aria-label={t(`landing:footer.${key}`)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          {SOCIALS[key]}
                        </svg>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className={styles.footerBottom}>
          <span>{t('landing:footer.copyright', { year, brand: BRAND.name })}</span>
          <button type="button" className={styles.backToTop} onClick={toTop}>
            {t('landing:footer.backToTop')}
            <Icon as={ArrowUp} size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </footer>
  )
}
