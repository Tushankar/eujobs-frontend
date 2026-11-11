import { Briefcase, Building2, Clock3, FileSignature, Globe2, Repeat } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BRAND } from '@/app/brand.js'
import careerGlass from '@/assets/landing/career-glass.webp'
import careerPhoto from '@/assets/landing/career-photo.webp'
import ctaGlass from '@/assets/landing/cta-glass.webp'
import ctaPhoto from '@/assets/landing/cta-photo.webp'
import faqGlowRed from '@/assets/landing/faq-glow-2.svg'
import faqGlowViolet from '@/assets/landing/faq-glow-1.svg'
import iconAdd from '@/assets/landing/icon-add.svg'
import iconClipboard from '@/assets/landing/icon-clipboard-tick.svg'
import iconClose from '@/assets/landing/icon-close.svg'
import iconCloud from '@/assets/landing/icon-document-cloud.svg'
import iconDocument from '@/assets/landing/icon-document-text.svg'
import iconUserSearch from '@/assets/landing/icon-user-search.svg'
import abx from '@/assets/landing/logo-abx.svg'
import aces from '@/assets/landing/logo-aces.svg'
import ataMask from '@/assets/landing/logo-ata-mask.svg'
import ata from '@/assets/landing/logo-ata.svg'
import cubana from '@/assets/landing/logo-cubana.svg'
import delta from '@/assets/landing/logo-delta.svg'
import egyptair from '@/assets/landing/logo-egyptair.svg'
import viking from '@/assets/landing/logo-viking.svg'
import westjet from '@/assets/landing/logo-westjet.svg'
import jobsGlowBlue from '@/assets/landing/jobs-glow-blue.svg'
import jobsGlowGreen from '@/assets/landing/jobs-glow-green.svg'
import circuit from '@/assets/landing/pattern-circuit.svg'
import contours from '@/assets/landing/pattern-contours.svg'
import stepsGlass from '@/assets/landing/steps-glass.webp'
import stepsPhoto from '@/assets/landing/steps-photo.webp'
import BrandLogo from '@/components/layout/BrandLogo.jsx'
import { CompanyLogo, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { ArrowPill, AvatarStack } from './LandingHero.jsx'
import { useCountUp } from './useLandingMotion.js'
import styles from './Landing.module.css'

/** A section title whose last words are in the brand blue. */
function Title({ lead, accent, as: Tag = 'h2' }) {
  return (
    <Tag className={styles.sectionTitle}>
      {lead} <span className={styles.accent}>{accent}</span>
    </Tag>
  )
}

/** Figma 396:798 — the owner kept the airline logos of the design (2026-11-11). */
export function TrustedStrip() {
  const { t } = useTranslation()
  return (
    <section className={styles.trusted} aria-labelledby="trusted-title">
      <h2 id="trusted-title" className={styles.trustedTitle}>
        {t('landing:trusted.title')}
      </h2>
      <div className={styles.trustedLogos}>
        <div className={styles.marquee} data-marquee>
          {[false, true].map((copy) => (
            <div key={String(copy)} className={styles.marqueeSet} aria-hidden={copy || undefined}>
              <img src={egyptair} alt="EgyptAir" />
              <img src={cubana} alt="Cubana" />
              <img src={delta} alt="Delta" />
              <span role="img" aria-label="ATA Airlines" className={styles.ata} style={{ backgroundImage: `url(${ata})`, maskImage: `url(${ataMask})`, WebkitMaskImage: `url(${ataMask})`, maskPosition: 'center', WebkitMaskPosition: 'center', maskSize: '84px 25.6px', WebkitMaskSize: '84px 25.6px' }} />
              <img src={westjet} alt="WestJet" />
              <img src={abx} alt="ABX Air" />
              <img src={viking} alt="Viking" />
              <img src={aces} alt="ACES" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* The six cards: the three work modes and three employment types, with live open-job counts. */
const CATEGORIES = [
  { group: 'workPreference', value: 'remote', icon: Globe2 },
  { group: 'workPreference', value: 'hybrid', icon: Repeat },
  { group: 'workPreference', value: 'on_site', icon: Building2 },
  { group: 'employmentType', value: 'full_time', icon: Briefcase },
  { group: 'employmentType', value: 'part_time', icon: Clock3 },
  { group: 'employmentType', value: 'contract', icon: FileSignature },
]

/** Figma 396:887. Every card opens the job list (it reads only `q` from the URL; its filters are on the page). */
export function Categories({ counts }) {
  const { t } = useTranslation()
  return (
    <section className={`${styles.card} ${styles.section}`} aria-labelledby="categories-title">
      <img src={circuit} alt="" className={styles.circuit} aria-hidden="true" />
      <div className={styles.sectionHead} data-reveal>
        <h2 id="categories-title" className={styles.sectionTitle}>
          {t('landing:categories.titleLead')} <span className={styles.accent}>{t('landing:categories.titleAccent')}</span>
        </h2>
        <p className={styles.sectionText}>{t('landing:categories.text')}</p>
      </div>
      <div className={styles.categories} data-stagger>
        {CATEGORIES.map(({ group, value, icon }, index) => (
          <Link key={value} to="/candidate/jobs" className={index === 0 ? `${styles.category} ${styles.categoryActive}` : styles.category}>
            <span className={styles.categoryIcon}>
              <Icon as={icon} size={15} />
            </span>
            <span>
              <h3 className={styles.categoryName}>{t(`enums:${group}.${value}`)}</h3>
              <p className={styles.categoryText}>{t(`landing:categories.${value}`)}</p>
              {counts && <CategoryCount value={counts[group][value]} />}
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
  return (
    <p ref={ref} className={styles.categoryCount}>
      {t('landing:categories.jobs', { count: value })}
    </p>
  )
}

const STEPS = [
  { key: 'register', icon: iconDocument },
  { key: 'search', icon: iconUserSearch },
  { key: 'resume', icon: iconCloud },
  { key: 'apply', icon: iconClipboard },
]

/** Figma 396:14249 ("About Us" in the nav). */
export function Steps() {
  const { t } = useTranslation()
  return (
    <section id="about" className={`${styles.steps} ${styles.anchor}`} aria-labelledby="steps-title">
      <img src={stepsGlass} alt="" className={styles.stepsGlass} aria-hidden="true" data-float />
      <div data-reveal>
        <h2 id="steps-title" className={styles.stepsTitle}>
          {t('landing:steps.titleLead')} <strong>{t('landing:steps.titleAccent')}</strong>
        </h2>
        <p className={styles.stepsText}>{t('landing:steps.text')}</p>
      </div>
      <div className={styles.stepsBody}>
        <img src={stepsPhoto} alt={t('landing:steps.imageAlt')} className={styles.stepsPhoto} data-wipe />
        <ol className={styles.stepList} data-stagger>
          {STEPS.map(({ key, icon }) => (
            <li key={key} className={styles.step}>
              <img src={icon} alt="" />
              <div>
                <h3 className={styles.stepTitle}>{t(`landing:steps.${key}Title`)}</h3>
                <p className={styles.stepText}>{t(`landing:steps.${key}Text`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** One job of Figma 396:14338 with live data (company logo, place, type, mode, years, salary, age). */
function JobRow({ job }) {
  const { t } = useTranslation()
  const format = useFormat()
  const text = useJobText()
  const place = text.place(job)
  const salary = text.salary(job)
  return (
    <article className={styles.job}>
      <div className={styles.jobTop}>
        <CompanyLogo name={job.company.name} src={job.company.logoUrl} size={34} className={styles.jobLogo} />
        <div className={styles.jobHead}>
          <h3 className={styles.jobTitle}>
            <Link to={`/candidate/jobs/${job.id}`}>{job.title}</Link>
          </h3>
          <p className={styles.jobCompany}>{[job.company.name, place].filter(Boolean).join(' • ')}</p>
        </div>
        {job.publishedAt && <time className={styles.jobAgo} dateTime={job.publishedAt}>{format.relative(job.publishedAt)}</time>}
      </div>
      <ul className={styles.jobTags}>
        {job.employmentType && <li>{t(`enums:employmentType.${job.employmentType}`)}</li>}
        {job.workPreference && <li>{t(`enums:workPreference.${job.workPreference}`)}</li>}
        {job.experienceYears != null && <li>{t('landing:vacancies.years', { count: job.experienceYears })}</li>}
      </ul>
      <div className={styles.jobBottom}>
        <AvatarStack to={`/candidate/jobs/${job.id}`} label={t('landing:vacancies.apply')} />
        <div className={styles.jobPay}>
          {salary && <span className={styles.jobSalary}>{salary}</span>}
          <Link to={`/candidate/jobs/${job.id}`} className={styles.jobApply}>
            {t('landing:vacancies.apply')} ↗
          </Link>
        </div>
      </div>
    </article>
  )
}

/** Figma 396:14290: the newest published jobs; `jobs` is null while they load (skeleton rows). */
export function Vacancies({ jobs }) {
  const { t } = useTranslation()
  return (
    <section id="jobs" className={`${styles.card} ${styles.section} ${styles.anchor}`} aria-labelledby="jobs-title">
      <img src={contours} alt="" className={styles.contours} aria-hidden="true" />
      <img src={jobsGlowGreen} alt="" className={styles.glow} style={{ left: -58, bottom: -472, width: 1113 }} aria-hidden="true" />
      <img src={jobsGlowBlue} alt="" className={styles.glow} style={{ left: 218, bottom: -459, width: 1049 }} aria-hidden="true" />
      <div className={styles.sectionHead} data-reveal>
        <Title lead={t('landing:vacancies.titleLead')} accent={t('landing:vacancies.titleAccent')} />
        <p className={styles.sectionText}>{t('landing:vacancies.text')}</p>
      </div>
      {!jobs ? (
        <SkeletonRegion className={styles.jobs}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={styles.job}>
              <Skeleton width="60%" />
              <Skeleton width="40%" />
              <Skeleton width="30%" />
            </div>
          ))}
        </SkeletonRegion>
      ) : jobs.length ? (
        <div className={styles.jobs} data-stagger>
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>{t('landing:vacancies.empty')}</p>
      )}
      {jobs?.length > 0 && (
        <div className={styles.jobsMore}>
          <ArrowPill to="/candidate/jobs">{t('landing:vacancies.all')}</ArrowPill>
        </div>
      )}
    </section>
  )
}

/** Figma 396:14642. */
export function CareerBanner() {
  const { t } = useTranslation()
  return (
    <section className={`${styles.card} ${styles.career}`} aria-labelledby="career-title">
      <img src={careerPhoto} alt={t('landing:career.imageAlt')} className={styles.careerPhoto} data-zoom />
      <div className={styles.careerPanel}>
        <img src={careerGlass} alt="" className={styles.careerGlass} aria-hidden="true" data-float />
        <div data-reveal>
          <h2 id="career-title" className={styles.careerTitle}>
            {t('landing:career.title')}
          </h2>
          <p className={styles.careerText}>{t('landing:career.text')}</p>
        </div>
      </div>
    </section>
  )
}

/** Figma 396:14767: the candidate help FAQs, the first one open. */
export function Faq({ faqs }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(0)
  if (!faqs.length) return null
  return (
    <section id="faq" className={`${styles.card} ${styles.section} ${styles.anchor}`} aria-labelledby="faq-title">
      <img src={faqGlowViolet} alt="" className={styles.glow} style={{ left: -59, bottom: -458, width: 1062 }} aria-hidden="true" />
      <img src={faqGlowRed} alt="" className={styles.glow} style={{ left: 106, bottom: -458, width: 1062 }} aria-hidden="true" />
      <div className={styles.sectionHead} data-reveal>
        <Title lead={t('landing:faq.titleLead')} accent={t('landing:faq.titleAccent')} />
        <p className={styles.sectionText}>{t('landing:faq.text')}</p>
      </div>
      <div className={styles.faqList} data-stagger>
        {faqs.map((faq, index) => {
          const expanded = open === index
          return (
            <div key={faq.id} className={expanded ? `${styles.faqItem} ${styles.faqOpen}` : styles.faqItem}>
              <button type="button" className={styles.faqButton} aria-expanded={expanded} aria-controls={`faq-${faq.id}`} onClick={() => setOpen(expanded ? -1 : index)}>
                <span className={styles.faqNumber}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.faqQuestion}>{faq.question}</span>
                <img src={expanded ? iconClose : iconAdd} alt="" className={styles.faqIcon} />
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

/** Figma 396:14853. */
export function CallToAction() {
  const { t } = useTranslation()
  return (
    <section className={styles.cta} aria-labelledby="cta-title">
      <div className={styles.ctaBody}>
        <img src={ctaGlass} alt="" className={styles.ctaGlass} aria-hidden="true" data-float />
        <div className={styles.ctaCopy} data-reveal>
          <h2 id="cta-title" className={styles.ctaTitle}>
            {t('landing:cta.title')}
          </h2>
          <p className={styles.ctaText}>{t('landing:cta.text')}</p>
          <ArrowPill to="/sign-up" white>
            {t('landing:cta.join')}
          </ArrowPill>
        </div>
      </div>
      <img src={ctaPhoto} alt={t('landing:cta.imageAlt')} className={styles.ctaPhoto} data-zoom />
    </section>
  )
}

const FOOTER_GROUPS = [
  { title: 'explore', links: [['#about', 'about'], ['#jobs', 'jobs'], ['#faq', 'faq']] },
  { title: 'account', links: [['/sign-in', 'signIn'], ['/sign-up', 'signUp'], ['/recruiter/sign-in', 'recruiters']] },
  { title: 'legal', links: [['/legal/privacy', 'privacy'], ['/legal/terms', 'terms'], ['/legal/imprint', 'imprint']] },
]

/**
 * Figma 396:14876 + 396:14910, filled out (owner 2026-11-11: no bare lists or empty space): brand column with the live
 * open-job count and a sign-up pill, three labelled link groups, copyright and back-to-top. Contact details and social
 * links stay out until real ones exist.
 */
export function Footer({ total }) {
  const { t } = useTranslation()
  const [year] = useState(() => new Date().getFullYear())
  return (
    <footer id="contact" className={`${styles.card} ${styles.footer} ${styles.anchor}`}>
      <div className={styles.footerTop} data-reveal>
        <div className={styles.footerBrand}>
          <BrandLogo height={44} />
          <p className={styles.footerBlurb}>{t('landing:footer.blurb')}</p>
          {total != null && (
            <p className={styles.footerLive}>
              <span className={styles.liveDot} aria-hidden="true" />
              {t('landing:footer.openJobs', { count: total })}
            </p>
          )}
          <ArrowPill to="/sign-up">{t('landing:footer.signUp')}</ArrowPill>
        </div>
        <nav className={styles.footerLinks} aria-label={t('landing:nav.label')}>
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className={styles.footerHeading}>{t(`landing:footer.${group.title}`)}</h3>
              <ul className={styles.footerColumn}>
                {group.links.map(([to, key]) => (
                  <li key={key}>{to.startsWith('#') ? <a href={to}>{t(`landing:footer.${key}`)}</a> : <Link to={to}>{t(`landing:footer.${key}`)}</Link>}</li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <span>{t('landing:footer.copyright', { year, brand: BRAND.name })}</span>
        <a href="#home" className={styles.backToTop}>
          {t('landing:footer.backToTop')} ↑
        </a>
      </div>
    </footer>
  )
}
