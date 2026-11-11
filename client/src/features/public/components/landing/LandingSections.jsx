import { Briefcase, Building2, Clock3, FileSignature, Globe2, Repeat } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BRAND } from '@/app/brand.js'
import careerGlass from '@/assets/landing/career-glass.webp'
import careerPhoto from '@/assets/landing/career-photo.webp'
import ctaGlass from '@/assets/landing/cta-glass.webp'
import ctaPhoto from '@/assets/landing/cta-photo.webp'
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
import circuit from '@/assets/landing/pattern-circuit.svg'
import contours from '@/assets/landing/pattern-contours.svg'
import stepsGlass from '@/assets/landing/steps-glass.webp'
import stepsPhoto from '@/assets/landing/steps-photo.webp'
import BrandLogo from '@/components/layout/BrandLogo.jsx'
import { CompanyLogo, Icon } from '@/components/ui'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { ArrowPill } from './LandingHero.jsx'
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
        <img src={egyptair} alt="EgyptAir" />
        <img src={cubana} alt="Cubana" />
        <img src={delta} alt="Delta" />
        <span role="img" aria-label="ATA Airlines" className={styles.ata} style={{ backgroundImage: `url(${ata})`, maskImage: `url(${ataMask})`, WebkitMaskImage: `url(${ataMask})`, maskPosition: 'center', WebkitMaskPosition: 'center', maskSize: '84px 25.6px', WebkitMaskSize: '84px 25.6px' }} />
        <img src={westjet} alt="WestJet" />
        <img src={abx} alt="ABX Air" />
        <img src={viking} alt="Viking" />
        <img src={aces} alt="ACES" />
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

/** Figma 396:887. Work-mode cards open the job list with that filter; employment types open the whole list. */
export function Categories({ counts }) {
  const { t } = useTranslation()
  return (
    <section className={`${styles.card} ${styles.section}`} aria-labelledby="categories-title">
      <img src={circuit} alt="" className={styles.circuit} aria-hidden="true" />
      <div className={styles.sectionHead}>
        <h2 id="categories-title" className={styles.sectionTitle}>
          {t('landing:categories.titleLead')} <span className={styles.accent}>{t('landing:categories.titleAccent')}</span>
        </h2>
        <p className={styles.sectionText}>{t('landing:categories.text')}</p>
      </div>
      <div className={styles.categories}>
        {CATEGORIES.map(({ group, value, icon }, index) => (
          <Link key={value} to={group === 'workPreference' ? `/candidate/jobs?workPreference=${value}` : '/candidate/jobs'} className={index === 0 ? `${styles.category} ${styles.categoryActive}` : styles.category}>
            <span className={styles.categoryIcon}>
              <Icon as={icon} size={15} />
            </span>
            <span>
              <h3 className={styles.categoryName}>{t(`enums:${group}.${value}`)}</h3>
              <p className={styles.categoryText}>{t(`landing:categories.${value}`)}</p>
              {counts && <p className={styles.categoryCount}>{t('landing:categories.jobs', { count: counts[group][value] })}</p>}
            </span>
          </Link>
        ))}
      </div>
    </section>
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
      <img src={stepsGlass} alt="" className={styles.stepsGlass} aria-hidden="true" />
      <h2 id="steps-title" className={styles.stepsTitle}>
        {t('landing:steps.titleLead')} <strong>{t('landing:steps.titleAccent')}</strong>
      </h2>
      <p className={styles.stepsText}>{t('landing:steps.text')}</p>
      <div className={styles.stepsBody}>
        <img src={stepsPhoto} alt={t('landing:steps.imageAlt')} className={styles.stepsPhoto} />
        <ol className={styles.stepList}>
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
        {salary && <span className={styles.jobSalary}>{salary}</span>}
        <Link to={`/candidate/jobs/${job.id}`} className={styles.jobApply}>
          {t('landing:vacancies.apply')} ↗
        </Link>
      </div>
    </article>
  )
}

/** Figma 396:14290: the newest published jobs. */
export function Vacancies({ jobs }) {
  const { t } = useTranslation()
  return (
    <section id="jobs" className={`${styles.card} ${styles.section} ${styles.anchor}`} aria-labelledby="jobs-title">
      <img src={contours} alt="" className={styles.contours} aria-hidden="true" />
      <span className={`${styles.glow} ${styles.glowGreen}`} aria-hidden="true" />
      <span className={`${styles.glow} ${styles.glowBlue}`} aria-hidden="true" />
      <div className={styles.sectionHead}>
        <Title lead={t('landing:vacancies.titleLead')} accent={t('landing:vacancies.titleAccent')} />
        <p className={styles.sectionText}>{t('landing:vacancies.text')}</p>
      </div>
      {jobs.length ? (
        <div className={styles.jobs}>
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>{t('landing:vacancies.empty')}</p>
      )}
    </section>
  )
}

/** Figma 396:14642. */
export function CareerBanner() {
  const { t } = useTranslation()
  return (
    <section className={`${styles.card} ${styles.career}`} aria-labelledby="career-title">
      <img src={careerPhoto} alt={t('landing:career.imageAlt')} className={styles.careerPhoto} />
      <div className={styles.careerPanel}>
        <img src={careerGlass} alt="" className={styles.careerGlass} aria-hidden="true" />
        <h2 id="career-title" className={styles.careerTitle}>
          {t('landing:career.title')}
        </h2>
        <p className={styles.careerText}>{t('landing:career.text')}</p>
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
      <span className={`${styles.faqGlow} ${styles.faqGlowViolet}`} aria-hidden="true" />
      <span className={`${styles.faqGlow} ${styles.faqGlowRed}`} aria-hidden="true" />
      <div className={styles.sectionHead}>
        <Title lead={t('landing:faq.titleLead')} accent={t('landing:faq.titleAccent')} />
        <p className={styles.sectionText}>{t('landing:faq.text')}</p>
      </div>
      <div className={styles.faqList}>
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
        <img src={ctaGlass} alt="" className={styles.ctaGlass} aria-hidden="true" />
        <h2 id="cta-title" className={styles.ctaTitle}>
          {t('landing:cta.title')}
        </h2>
        <p className={styles.ctaText}>{t('landing:cta.text')}</p>
        <ArrowPill to="/sign-up" white>
          {t('landing:cta.join')}
        </ArrowPill>
      </div>
      <img src={ctaPhoto} alt={t('landing:cta.imageAlt')} className={styles.ctaPhoto} />
    </section>
  )
}

/** Figma 396:14876 + 396:14910 (contact details and social links are left out until they exist). */
export function Footer() {
  const { t } = useTranslation()
  const [year] = useState(() => new Date().getFullYear())
  return (
    <footer id="contact" className={`${styles.card} ${styles.footer} ${styles.anchor}`}>
      <div className={styles.footerTop}>
        <BrandLogo height={37} />
        <div className={styles.footerLinks}>
          <ul className={styles.footerColumn}>
            <li><a href="#about">{t('landing:footer.about')}</a></li>
            <li><a href="#jobs">{t('landing:footer.jobs')}</a></li>
            <li><a href="#faq">{t('landing:footer.faq')}</a></li>
          </ul>
          <ul className={styles.footerColumn}>
            <li><Link to="/sign-in">{t('landing:footer.signIn')}</Link></li>
            <li><Link to="/sign-up">{t('landing:footer.signUp')}</Link></li>
            <li><Link to="/recruiter/sign-in">{t('landing:footer.recruiters')}</Link></li>
          </ul>
          <ul className={styles.footerColumn}>
            <li><Link to="/legal/privacy">{t('landing:footer.privacy')}</Link></li>
            <li><Link to="/legal/terms">{t('landing:footer.terms')}</Link></li>
            <li><Link to="/legal/imprint">{t('landing:footer.imprint')}</Link></li>
          </ul>
        </div>
      </div>
      <p className={styles.footerBottom}>{t('landing:footer.copyright', { year, brand: BRAND.name })}</p>
    </footer>
  )
}
