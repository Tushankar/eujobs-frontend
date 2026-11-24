import { useLayoutEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ArrowLeft, ArrowUpRight, Bookmark, BriefcaseBusiness, CalendarDays, Globe, MapPin, Plane, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { CompanyLogo, Icon, Skeleton, SkeletonRegion, Switch } from '@/components/ui'
import SkillPills from '@/components/common/SkillPills.jsx'
import VerifiedCompany from '@/components/common/VerifiedCompany.jsx'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetPublicJobsQuery } from '../api.js'
import PublicShell from '../components/PublicShell.jsx'
import JobSearchForm from '../components/landing/JobSearchForm.jsx'
import landing from '../components/landing/Landing.module.css'
import shell from '../components/PublicShell.module.css'
import styles from './PublicJobsPage.module.css'
import { useSectors } from '@/lib/sectors.js'

/* The landing page's six categories (and Agency) as tabs (one work mode or employment type at a time), after "All jobs". */
const TABS = [
  { group: 'workPreference', value: 'remote' },
  { group: 'workPreference', value: 'hybrid' },
  { group: 'workPreference', value: 'on_site' },
  { group: 'employmentType', value: 'full_time' },
  { group: 'employmentType', value: 'part_time' },
  { group: 'employmentType', value: 'contract' },
  // 2026-11-20: every agency job (the landing's agency section links here).
  { group: 'employmentType', value: 'agency' },
]
const GROUPS = ['workPreference', 'employmentType']
const REDUCE = '(prefers-reduced-motion: reduce)'

/** Apply and Save need an account: sign-in comes back to this job in Find jobs. */
const signInFor = (job) => `/sign-in?next=${encodeURIComponent(`/candidate/jobs/${job.id}`)}`
const hostOf = (website) => new URL(website).hostname.replace(/^www\./, '')

/**
 * /jobs (owner 2026-11-16): the public job list behind the landing page's job links, so visitors browse without signing
 * in. LinkedIn split view: category tabs with live counts and a search, the list on the left and the chosen job pinned on
 * the right; phones show one or the other. The URL holds the search, the tab and the open job (`?job=`).
 */
export default function PublicJobsPage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const location = params.get('location') ?? ''
  const tab = GROUPS.map((group) => params.get(group) && `${group}:${params.get(group)}`).find(Boolean) ?? 'all'
  // Only jobs that sponsor a work visa (?visa=1, 2026-11-16).
  const visa = params.get('visa') === '1'
  const query = { language: i18n.language, q, location, ...Object.fromEntries(GROUPS.map((group) => [group, params.get(group)]).filter(([, value]) => value)), ...(visa && { visa: '1' }) }
  const { data, isFetching, isError } = useGetPublicJobsQuery(query)
  useDocumentTitle(t('website:jobs.title'))
  const root = useRef(null)
  const items = data?.items ?? []
  const openId = params.get('job')
  const job = items.find((item) => item.id === openId) ?? items[0] ?? null

  /** Changes the search or tab (replacing history) and closes the open job, so the first result shows. */
  function update(changes) {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
    next.delete('job')
    setParams(next, { replace: true })
  }
  function open(id) {
    const next = new URLSearchParams(params)
    next.set('job', id)
    setParams(next)
    if (window.matchMedia('(max-width: 899px)').matches) root.current?.scrollIntoView({ block: 'start' })
  }
  function close() {
    const next = new URLSearchParams(params)
    next.delete('job')
    setParams(next)
  }

  // The header rises in once; rows cascade in for each new result set; the open job's sections settle in on change.
  useGSAP(
    () => {
      const move = window.matchMedia(REDUCE).matches ? 0 : 1
      gsap.from('[data-intro]', { y: 22 * move, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' })
    },
    { scope: root },
  )
  const resultsKey = data ? items.map((item) => item.id).join() : ''
  useGSAP(
    () => {
      if (!resultsKey) return
      const move = window.matchMedia(REDUCE).matches ? 0 : 1
      // Rows after the 12th rise with the 12th (owner 2026-11-24), so a long list doesn't cascade for seconds.
      gsap.from('[data-row]', { y: 16 * move, opacity: 0, duration: 0.55, stagger: (index) => Math.min(index, 12) * 0.045, ease: 'power3.out', clearProps: 'transform,opacity' })
    },
    { scope: root, dependencies: [resultsKey] },
  )
  useGSAP(
    () => {
      if (!job) return
      const move = window.matchMedia(REDUCE).matches ? 0 : 1
      gsap.from('[data-detail] [data-part]', { y: 14 * move, opacity: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' })
    },
    { scope: root, dependencies: [job?.id] },
  )

  return (
    <PublicShell>
      <section ref={root} className={`${landing.card} ${shell.panel} ${styles.panel}`} aria-labelledby="jobs-title">
        <header className={styles.head}>
          <h1 id="jobs-title" className={shell.title} data-intro>
            {t('website:jobs.titleLead')} <span className={landing.accent}>{t('website:jobs.titleAccent')}</span>
          </h1>
          <p className={shell.lead} data-intro>
            {t('website:jobs.text')}
          </p>
          <JobSearchForm key={`${q}|${location}`} q={q} location={location} onSearch={update} className={styles.search} data-intro />
          <div className={styles.filters} data-intro>
            <Tabs active={tab} counts={data && { all: data.total, ...data.counts }} onChange={(key) => update(Object.fromEntries(GROUPS.map((group) => [group, key.startsWith(`${group}:`) ? key.split(':')[1] : null])))} />
          </div>
        </header>

        {/* The count and "Visa sponsorship only" (2026-11-16): shown with no results too, so the switch can go off. */}
        {data && !isError && (
          <div className={styles.resultsBar}>
            <p className={styles.results} aria-live="polite">
              {t('website:jobs.results', { count: items.length })}
            </p>
            <label className={styles.visaSwitch}>
              <Switch checked={visa} onChange={(on) => update({ visa: on ? '1' : null })} label={t('website:jobs.visaOnly')} />
              <span aria-hidden="true">{t('website:jobs.visaOnly')}</span>
            </label>
          </div>
        )}
        {isError ? (
          <p className={shell.empty}>{t('website:loadError')}</p>
        ) : !data ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <Icon as={SearchX} size={28} />
            <h2 className={styles.emptyTitle}>{t('website:jobs.emptyTitle')}</h2>
            <p className={styles.emptyText}>{t('website:jobs.emptyText')}</p>
            <button type="button" className={styles.outline} onClick={() => setParams({}, { replace: true })}>
              {t('website:jobs.clear')}
            </button>
          </div>
        ) : (
          <div className={cx(styles.layout, openId && styles.layoutOpen)}>
            <div className={cx(styles.list, isFetching && styles.busy)} aria-busy={isFetching}>
              <ul className={styles.rows}>
                {items.map((item) => (
                  <li key={item.id} data-row>
                    <JobRow job={item} active={item.id === job?.id} onOpen={() => open(item.id)} />
                  </li>
                ))}
              </ul>
            </div>
            {job && <JobDetail key={job.id} job={job} onBack={close} />}
          </div>
        )}
      </section>
    </PublicShell>
  )
}

/** Pill tabs with live counts; the brand-blue pill slides to the chosen tab. */
function Tabs({ active, counts, onChange }) {
  const { t } = useTranslation()
  const bar = useRef(null)
  const [pill, setPill] = useState(null)
  const tabs = [{ key: 'all', label: t('website:jobs.all'), count: counts?.all }, ...TABS.map(({ group, value }) => ({ key: `${group}:${value}`, label: t(`enums:${group}.${value}`), count: counts?.[group][value] }))]

  useLayoutEffect(() => {
    const measure = () => {
      const button = bar.current?.querySelector('[aria-selected="true"]')
      if (!button) return
      setPill({ left: button.offsetLeft, width: button.offsetWidth })
      // On narrow screens the bar scrolls: keep the chosen tab fully in view.
      const { scrollLeft, clientWidth } = bar.current
      if (button.offsetLeft < scrollLeft || button.offsetLeft + button.offsetWidth > scrollLeft + clientWidth) bar.current.scrollTo({ left: button.offsetLeft - 24, behavior: 'smooth' })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(bar.current)
    return () => observer.disconnect()
  }, [active, counts])

  return (
    <div ref={bar} className={styles.tabs} role="tablist" aria-label={t('website:jobs.categories')}>
      {pill && <span className={styles.tabPill} style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} aria-hidden="true" />}
      {tabs.map(({ key, label, count }) => (
        <button key={key} type="button" role="tab" aria-selected={key === active} className={cx(styles.tab, key === active && styles.tabActive)} onClick={() => onChange(key)}>
          {label}
          {count != null && <span className={styles.tabCount}>{count}</span>}
        </button>
      ))}
    </div>
  )
}

function JobRow({ job, active, onOpen }) {
  const { t } = useTranslation()
  const format = useFormat()
  const text = useJobText()
  // 2026-11-20: an agency job shows its pay rate instead of a salary.
  const salary = !job.agency && text.salary(job)
  return (
    <button type="button" className={cx(styles.row, active && styles.rowActive)} aria-current={active || undefined} onClick={onOpen}>
      <CompanyLogo name={job.company.displayName} id={job.company.id} src={job.company.logoUrl ?? undefined} size={44} />
      <span className={styles.rowBody}>
        <span className={styles.rowTitle}>{job.title}</span>
        <span className={styles.rowCompany}>{[job.company.displayName, job.agency && text.client(job), text.place(job)].filter(Boolean).join(' · ')}</span>
        <span className={styles.rowTags}>
          {job.agency && <span>{t('agency:candidate.agencyTag')}</span>}
          {job.workPreference && <span>{t(`enums:workPreference.${job.workPreference}`)}</span>}
          {job.employmentType && <span>{t(`enums:employmentType.${job.employmentType}`)}</span>}
          {job.agency && <span>{text.dates(job.agency)}</span>}
          {job.visaSponsorship && <span data-visa-sponsorship>{t('common:visaSponsorship')}</span>}
        </span>
        {salary && <span className={styles.rowSalary}>{salary}</span>}
        {job.agency?.rate && <span className={styles.rowSalary}>{text.rate(job.agency)}</span>}
      </span>
      {job.publishedAt && (
        <time className={styles.rowAgo} dateTime={job.publishedAt}>
          {format.relative(job.publishedAt)}
        </time>
      )}
    </button>
  )
}

/** The open job, pinned beside the list: what a candidate reads, with Apply and Save going through sign-in. */
function JobDetail({ job, onBack }) {
  const { t } = useTranslation()
  const sectors = useSectors()
  const format = useFormat()
  const text = useJobText()
  const { company } = job
  const salary = !job.agency && text.salary(job)
  const eligible = text.eligible(job)
  const conditions = [
    ...job.requiredLanguages.map((language) => t('findJobs:details.languageLevel', { language: format.languageName(language.code), level: t(`enums:languageLevel.${language.minLevel}`) })),
    eligible && t('findJobs:details.eligible', { countries: eligible }),
  ].filter(Boolean)

  return (
    <article className={styles.detail} aria-labelledby="job-title" data-detail>
      <button type="button" className={styles.back} onClick={onBack}>
        <Icon as={ArrowLeft} size={14} />
        {t('website:jobs.back')}
      </button>
      <header className={styles.detailHead} data-part>
        <CompanyLogo name={company.displayName} id={company.id} src={company.logoUrl ?? undefined} size={52} />
        <div>
          <VerifiedCompany className={styles.detailCompany} name={company.displayName} verified={company.verified} />
          <p className={styles.detailPosted}>{[sectors.industry(company), job.publishedAt && t('findJobs:details.posted', { time: format.relative(job.publishedAt) })].filter(Boolean).join(' · ')}</p>
        </div>
      </header>
      <h2 id="job-title" className={styles.detailTitle} data-part>
        {job.title}
      </h2>
      {job.agency && (
        <p className={styles.detailPosted} data-part>
          {[t('agency:candidate.agencyTag'), text.client(job)].join(' · ')}
        </p>
      )}
      <ul className={styles.facts} data-part>
        {job.country !== 'REMOTE' && (
          <li>
            <Icon as={MapPin} size={15} />
            {text.place(job)}
          </li>
        )}
        {job.workPreference && (
          <li>
            <Icon as={Globe} size={15} />
            {t(`enums:workPreference.${job.workPreference}`)}
          </li>
        )}
        <li>
          <Icon as={BriefcaseBusiness} size={15} />
          {t(`enums:employmentType.${job.employmentType}`)}
        </li>
        {job.visaSponsorship && (
          <li data-visa-sponsorship>
            <Icon as={Plane} size={15} />
            {t('findJobs:details.visa')}
          </li>
        )}
        {job.agency && (
          <li>
            <Icon as={CalendarDays} size={15} />
            {text.dates(job.agency)}
          </li>
        )}
        {salary && <li className={styles.factSalary}>{salary}</li>}
        {job.agency?.rate && <li className={styles.factSalary}>{text.rate(job.agency)}</li>}
      </ul>
      <div className={styles.actions} data-part>
        <Link to={signInFor(job)} className={styles.apply}>
          {t('website:jobs.apply')}
          <Icon as={ArrowUpRight} size={16} />
        </Link>
        <Link to={signInFor(job)} className={styles.outline}>
          <Icon as={Bookmark} size={15} />
          {t('findJobs:details.save')}
        </Link>
      </div>
      <p className={styles.signInNote} data-part>
        {t('website:jobs.signInNote')} <Link to="/sign-up">{t('website:jobs.signUp')}</Link>
      </p>

      {job.brief && (
        <Section title={t('findJobs:details.about')}>
          <p className={styles.prose}>{job.brief}</p>
        </Section>
      )}
      {job.responsibilities.length > 0 && (
        <Section title={t('findJobs:details.responsibilities')}>
          <ul className={styles.bullets}>
            {job.responsibilities.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>
      )}
      {job.requiredSkills.length > 0 && (
        <Section title={t('findJobs:details.requiredSkills')}>
          <SkillPills skills={job.requiredSkills} />
        </Section>
      )}
      {job.preferredSkills.length > 0 && (
        <Section title={t('findJobs:details.preferredSkills')}>
          <SkillPills skills={job.preferredSkills} />
        </Section>
      )}
      {(conditions.length > 0 || job.experienceYears != null) && (
        <Section title={t('website:jobs.requirements')}>
          <ul className={styles.bullets}>
            {job.experienceYears != null && <li>{t('findJobs:details.years', { count: job.experienceYears })}</li>}
            {conditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </Section>
      )}

      <section className={styles.company} data-part>
        <h3 className={styles.sectionTitle}>{t('findJobs:details.aboutCompany')}</h3>
        <div className={styles.companyHead}>
          <CompanyLogo name={company.displayName} id={company.id} src={company.logoUrl ?? undefined} size={40} />
          <div>
            <VerifiedCompany className={styles.companyName} name={company.displayName} verified={company.verified} />
            <p className={styles.detailPosted}>{[sectors.industry(company), company.size && t(`enums:companySize.${company.size}`)].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        {company.description && <p className={styles.prose}>{company.description}</p>}
        {company.website && (
          <a href={company.website} target="_blank" rel="noopener noreferrer" className={styles.website}>
            <Icon as={Globe} size={15} />
            {hostOf(company.website)}
            <Icon as={ArrowUpRight} size={14} />
          </a>
        )}
      </section>
    </article>
  )
}

function Section({ title, children }) {
  return (
    <section className={styles.section} data-part>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  )
}

/** The split view while the first results load: row and detail placeholders under the real heading. */
function ListSkeleton() {
  return (
    <SkeletonRegion className={styles.layout}>
      <div className={styles.list}>
        <Skeleton width={90} height={10} />
        <div className={styles.rows}>
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className={styles.row}>
              <Skeleton shape="block" width={44} height={44} />
              <span className={styles.rowBody}>
                <Skeleton width="70%" />
                <Skeleton width="45%" height={10} />
                <Skeleton width="35%" height={10} />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.detail}>
        <Skeleton shape="block" width={52} height={52} />
        <Skeleton width="55%" height={26} />
        <Skeleton width="70%" />
        <Skeleton shape="pill" width={180} height={44} />
        <Skeleton />
        <Skeleton />
        <Skeleton width="60%" />
      </div>
    </SkeletonRegion>
  )
}
