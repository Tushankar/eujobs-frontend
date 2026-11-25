import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Bookmark, BriefcaseBusiness, CalendarDays, Check, ChevronRight, Globe, Layers, MapPin, Plane, SearchX } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Button, CompanyLogo, Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SkillPills from '@/components/common/SkillPills.jsx'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import Translatable from '@/features/ai/components/Translatable.jsx'
import { AgencyTerms, JoinAgency, LockBanner } from '@/features/candidate/agencies/components/JobAgency.jsx'
import { PlacementRules } from '@/features/candidate/agencies/components/PlacementRules.jsx'
import { ApplyButton } from '@/features/candidate/applications/components/ApplyFlow.jsx'
import { MessageCompanyButton } from '@/features/messages/components/StartConversation.jsx'
import ReportButton from '@/features/moderation/components/ReportButton.jsx'
import { useJobText } from '@/lib/jobText.js'
import VerifiedCompany from '@/components/common/VerifiedCompany.jsx'
import { useFormat } from '@/lib/preferences.js'
import { useBackTo } from '@/lib/urlState.js'
import { useGetJobQuery, useSaveToggle } from '../api.js'
import MatchBadge from '../components/MatchBadge.jsx'
import styles from './JobDetailsPage.module.css'
import { useMarkSeen } from '@/features/notifications/api.js'
import { useSectors } from '@/lib/sectors.js'

/** The company website as its bare host ("kyptronix.com"); the server always stores it with https://. */
const hostOf = (website) => new URL(website).hostname.replace(/^www\./, '')

/** A bulleted section; with `source`, the items can be translated on demand (M-144). */
function ListSection({ title, items, source }) {
  if (!items?.length) return null
  const list = (shown) => (
    <ul className={styles.bullets}>
      {shown.map((item, index) => (
        <li key={index} className={styles.bullet}>
          {item}
        </li>
      ))}
    </ul>
  )
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>{title}</h2>
      {source ? (
        <Translatable source={source} texts={items}>
          {list}
        </Translatable>
      ) : (
        list(items)
      )}
    </section>
  )
}

function SkillSection({ title, skills }) {
  if (!skills?.length) return null
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>{title}</h2>
      <SkillPills skills={skills} className={styles.skills} />
    </section>
  )
}

/** The skill-overlap evidence every candidate sees (M-050, M-052); the score is in the header badge (C6). */
function SkillEvidence({ job }) {
  const { t } = useTranslation()
  const format = useFormat()
  const missing = job.requiredSkills.filter((skill) => !job.overlap.matched.includes(skill))
  return (
    <section className={styles.why}>
      <div className={styles.whyHead}>
        <h2 className={styles.h2Tight}>{t('findJobs:details.match')}</h2>
      </div>
      <div className={styles.insights}>
        <p className={styles.insightsLabel}>
          <img src={aiGlyph} alt="" width={14} height={14} />
          {t('findJobs:card.overlap', { count: job.overlap.count, total: job.overlap.total })}
        </p>
        <div className={styles.insightsBody}>
          {job.overlap.matched.length > 0 && (
            <>
              <p className={styles.eyebrow}>{t('findJobs:details.matched')}</p>
              <ul className={styles.evidence}>
                {job.overlap.matched.map((skill) => (
                  <li key={skill} className={styles.evidenceChip}>
                    <Icon as={Check} size={10} strokeWidth={2.2} />
                    {skill}
                  </li>
                ))}
              </ul>
            </>
          )}
          {job.experienceYears != null && (
            <p className={styles.experience}>
              <Icon as={Check} size={13} />
              {t('findJobs:details.years', { count: job.experienceYears })}
            </p>
          )}
          <div className={styles.gap}>
            <p className={styles.gapTitle}>{t('findJobs:details.gap')}</p>
            <p className={styles.gapText}>{missing.length ? t('findJobs:details.gapText', { skills: format.list(missing) }) : t('findJobs:details.noGap')}</p>
          </div>
        </div>
        <p className={styles.disclaimer}>{t('findJobs:details.evidence')}</p>
      </div>
    </section>
  )
}

/**
 * Job details (M-036, M-043): empty sections are hidden and there are no static perks. A paused, closed or hidden job
 * stays readable for the candidates who saved it, marked as no longer accepting; everyone else gets "no longer
 * available". Apply goes through the gate (§3.4).
 */
export default function JobDetailsPage() {
  const { t } = useTranslation()
  const sectors = useSectors()
  const format = useFormat()
  const jobText = useJobText()
  const { jobId } = useParams()
  // Back returns to Find jobs with its search and filters when opened from there (perf 2026-11-24).
  const backTo = useBackTo('/candidate/jobs')
  // P11b-Q10: opening this item marks its notifications read.
  useMarkSeen('job', jobId)
  const { data: job, error, isLoading } = useGetJobQuery(jobId)
  const toggleSave = useSaveToggle()

  const back = (
    <Link to={backTo} className={styles.back}>
      <Icon as={ArrowLeft} size={14} />
      {t('findJobs:details.back')}
    </Link>
  )
  if (error) {
    return (
      <div className={styles.page}>
        {back}
        <EmptyState
          icon={SearchX}
          title={t('findJobs:details.unavailable')}
          description={t('findJobs:details.unavailableText')}
          action={
            <Button as={Link} to="/candidate/jobs">
              {t('findJobs:details.find')}
            </Button>
          }
        />
      </div>
    )
  }
  if (!job) {
    return (
      <div className={styles.page}>
        {back}
        {isLoading && <JobDetailsSkeleton />}
      </div>
    )
  }

  const { company } = job
  const eligible = jobText.eligible(job)
  const conditions = [
    ...job.requiredLanguages.map((language) => t('findJobs:details.languageLevel', { language: format.languageName(language.code), level: t(`enums:languageLevel.${language.minLevel}`) })),
    eligible && t('findJobs:details.eligible', { countries: eligible }),
  ].filter(Boolean)

  return (
    <div className={styles.page}>
      {back}
      {!job.accepting && (
        <div className={styles.closed} role="status">
          <strong>{t('findJobs:details.notAccepting')}</strong> {t('findJobs:details.notAcceptingText')}
        </div>
      )}
      <LockBanner job={job} />

      <div className={styles.layout}>
        <article className={`${styles.article} sticky-side`}>
          <header className={styles.hero}>
            <CompanyLogo name={company.displayName} id={company.id} src={company.logoUrl ?? undefined} size={44} />
            <div className={styles.heroText}>
              <div className={styles.heroRow}>
                <VerifiedCompany className={styles.company} name={company.displayName} verified={company.verified} />
                {job.agency && <PillBadge tone="neutral">{t('agency:candidate.agencyTag')}</PillBadge>}
                <MatchBadge job={job} />
              </div>
              <p className={styles.posted}>{[sectors.industry(company), job.publishedAt && t('findJobs:details.posted', { time: format.relative(job.publishedAt) })].filter(Boolean).join(' · ')}</p>
            </div>
          </header>

          <h1 className={styles.title}>{job.title}</h1>
          {job.agency && <p className={styles.posted}>{jobText.client(job)}</p>}

          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <Icon as={MapPin} size={14} />
              {jobText.place(job)}
            </span>
            <span className={styles.metaItem}>
              <Icon as={Globe} size={14} />
              {t(`enums:workPreference.${job.workPreference}`)}
            </span>
            <span className={styles.metaItem}>
              <Icon as={BriefcaseBusiness} size={14} />
              {t(`enums:employmentType.${job.employmentType}`)}
            </span>
            {sectors.name(job.sector) && (
              <span className={styles.metaItem} data-job-sector={job.sector}>
                <Icon as={Layers} size={14} />
                {sectors.name(job.sector)}
              </span>
            )}
            {job.visaSponsorship && (
              <span className={styles.metaItem} data-visa-sponsorship>
                <Icon as={Plane} size={14} />
                {t('findJobs:details.visa')}
              </span>
            )}
            {job.agency && (
              <span className={styles.metaItem}>
                <Icon as={CalendarDays} size={14} />
                {jobText.dates(job.agency)}
              </span>
            )}
            {job.salary && !job.agency && <span className={styles.salary}>{jobText.salary(job)}</span>}
            {job.agency?.rate && <span className={styles.salary}>{jobText.rate(job.agency)}</span>}
          </div>

          <SkillEvidence job={job} />
          {job.agency && <AgencyTerms job={job} />}
          {/* 2026-11-23: eligibility and the rules a placement would follow, before applying. */}
          {job.agency && <PlacementRules job={job} />}

          {job.brief && (
            <section className={styles.section}>
              <h2 className={styles.h2}>{t('findJobs:details.about')}</h2>
              <Translatable source={{ entity: 'job', id: job.id, field: 'brief' }} texts={[job.brief]}>
                {([brief]) => <p className={styles.about}>{brief}</p>}
              </Translatable>
            </section>
          )}
          <ListSection title={t('findJobs:details.responsibilities')} items={job.responsibilities} source={{ entity: 'job', id: job.id, field: 'responsibilities' }} />
          <SkillSection title={t('findJobs:details.requiredSkills')} skills={job.requiredSkills} />
          <SkillSection title={t('findJobs:details.preferredSkills')} skills={job.preferredSkills} />
          <ListSection title={t('findJobs:details.languages')} items={conditions} />
        </article>

        <aside className={`${styles.rail} sticky-side`} aria-label={t('findJobs:details.railTitle')}>
          <section className={styles.card}>
            <h2 className={styles.railTitle}>{t('findJobs:details.railTitle')}</h2>
            <p className={styles.railText}>{t('findJobs:details.railText')}</p>
            <div className={styles.railActions}>
              <ApplyButton job={job} fullWidth />
              <Button
                variant="secondary"
                fullWidth
                className={cx(styles.saveButton, job.saved && styles.saveButtonOn)}
                aria-pressed={job.saved}
                disabled={!job.accepting && !job.saved}
                leftIcon={<Icon as={Bookmark} size={14} className={cx(job.saved && styles.filledIcon)} />}
                onClick={() => toggleSave(job)}
              >
                {t(job.saved ? 'findJobs:details.saved' : 'findJobs:details.save')}
              </Button>
              {job.application && <MessageCompanyButton job={job} canStart={job.application.status !== 'withdrawn'} fullWidth />}
              {job.agency && <JoinAgency job={job} />}
            </div>
            {job.application && <p className={styles.railText}>{t('applications:apply.sent')}</p>}
            <ReportButton targetType="job" targetId={job.id} size="sm" className={styles.report} />
          </section>

          <section className={styles.card} aria-labelledby="about-company">
            <h2 id="about-company" className={styles.aboutHeading}>
              {t('findJobs:details.aboutCompany')}
            </h2>
            <div className={styles.aboutHead}>
              <CompanyLogo name={company.displayName} id={company.id} src={company.logoUrl ?? undefined} size={48} />
              <div className={styles.aboutHeadText}>
                <VerifiedCompany className={styles.aboutName} name={company.displayName} verified={company.verified} />
                <p className={styles.aboutMeta}>{[sectors.industry(company), company.size && t(`enums:companySize.${company.size}`)].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            {company.description && (
              <Translatable source={{ entity: 'company', id: company.id, field: 'description' }} texts={[company.description]}>
                {([description]) => <p className={styles.aboutText}>{description}</p>}
              </Translatable>
            )}
            <ul className={styles.aboutRows}>
              {company.website && (
                <li>
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className={styles.aboutRow}>
                    <span className={styles.aboutRowLabel}>
                      <Icon as={Globe} size={16} />
                      {hostOf(company.website)}
                    </span>
                    <Icon as={ArrowUpRight} size={14} className={styles.aboutRowIcon} />
                  </a>
                </li>
              )}
              <li>
                <Link to={`/candidate/jobs?q=${encodeURIComponent(company.displayName)}`} className={styles.aboutRow}>
                  <span className={styles.aboutRowLabel}>
                    <Icon as={BriefcaseBusiness} size={16} />
                    {t('findJobs:details.companyJobs', { company: company.displayName })}
                  </span>
                  <Icon as={ChevronRight} size={14} className={styles.aboutRowIcon} />
                </Link>
              </li>
            </ul>
            <ReportButton targetType="company" targetId={company.id} size="sm" className={styles.report} />
          </section>
        </aside>
      </div>
    </div>
  )
}

/** The job's layout while it loads: the real section and rail headings, placeholders for the job's own text. */
function JobDetailsSkeleton() {
  const { t } = useTranslation()
  return (
    <div className={styles.layout}>
      <SkeletonRegion className={styles.article}>
        <div className={styles.hero}>
          <Skeleton shape="circle" width={44} height={44} />
          <div className={styles.heroText}>
            <Skeleton width={140} height={12} />
            <p className={styles.posted}>
              <Skeleton width={180} height={8} />
            </p>
          </div>
        </div>
        <div className={styles.title}>
          <Skeleton width="60%" height={24} />
        </div>
        <div className={styles.meta}>
          <Skeleton width={110} />
          <Skeleton width={64} />
          <Skeleton width={72} />
        </div>
        <section className={styles.why}>
          <h2 className={styles.h2Tight}>{t('findJobs:details.match')}</h2>
          <div className={styles.insights}>
            <Skeleton width={160} />
            <div className={styles.insightsBody}>
              <Skeleton width={120} />
              <div className={styles.evidence}>
                {[96, 64, 88].map((width) => (
                  <Skeleton key={width} shape="pill" width={width} height={25} />
                ))}
              </div>
              <p className={styles.experience}>
                <Skeleton width="40%" />
              </p>
              <div className={styles.gap}>
                <Skeleton width="50%" />
              </div>
            </div>
          </div>
        </section>
        <section className={styles.section}>
          <h2 className={styles.h2}>{t('findJobs:details.about')}</h2>
          <div className={styles.aboutSkeleton}>
            <Skeleton />
            <Skeleton />
            <Skeleton width="65%" />
          </div>
        </section>
      </SkeletonRegion>

      <aside className={`${styles.rail} sticky-side`}>
        <section className={styles.card}>
          <h2 className={styles.railTitle}>{t('findJobs:details.railTitle')}</h2>
          <p className={styles.railText}>{t('findJobs:details.railText')}</p>
          <div className={styles.railActions}>
            <Skeleton shape="pill" width="100%" height={40} />
            <Skeleton shape="pill" width="100%" height={40} />
          </div>
        </section>
        <section className={styles.card}>
          <Skeleton width="60%" height={12} />
          <div className={styles.aboutSkeleton}>
            <Skeleton />
            <Skeleton width="80%" />
          </div>
        </section>
      </aside>
    </div>
  )
}
