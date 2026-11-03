import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Bookmark, Building2, BriefcaseBusiness, Check, Globe, MapPin, SearchX, Users } from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Button, CompanyLogo, Icon } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import { ApplyButton } from '@/features/candidate/applications/components/ApplyFlow.jsx'
import { MessageCompanyButton } from '@/features/messages/components/StartConversation.jsx'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetJobQuery, useSaveToggle } from '../api.js'
import styles from './JobDetailsPage.module.css'

function ListSection({ title, items }) {
  if (!items?.length) return null
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>{title}</h2>
      <ul className={styles.bullets}>
        {items.map((item) => (
          <li key={item} className={styles.bullet}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

function SkillSection({ title, skills }) {
  if (!skills?.length) return null
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>{title}</h2>
      <ul className={styles.skills}>
        {skills.map((skill) => (
          <li key={skill} className={styles.skill}>
            {skill}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The skill-overlap evidence every candidate sees (M-050, M-052): no score and no AI until Phase 9. */
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
  const format = useFormat()
  const jobText = useJobText()
  const { jobId } = useParams()
  const { data: job, error } = useGetJobQuery(jobId)
  const toggleSave = useSaveToggle()

  const back = (
    <Link to="/candidate/jobs" className={styles.back}>
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
  if (!job) return <div className={styles.page}>{back}</div>

  const { company } = job
  const eligible = jobText.eligible(job)
  const conditions = [
    ...job.requiredLanguages.map((language) => t('findJobs:details.languageLevel', { language: format.languageName(language.code), level: t(`enums:languageLevel.${language.minLevel}`) })),
    eligible && t('findJobs:details.eligible', { countries: eligible }),
    job.visaSponsorship && t('findJobs:details.visa'),
  ].filter(Boolean)

  return (
    <div className={styles.page}>
      {back}
      {!job.accepting && (
        <div className={styles.closed} role="status">
          <strong>{t('findJobs:details.notAccepting')}</strong> {t('findJobs:details.notAcceptingText')}
        </div>
      )}

      <div className={styles.layout}>
        <article className={styles.article}>
          <header className={styles.hero}>
            <CompanyLogo name={company.displayName} id={company.id} src={company.logoUrl ?? undefined} size={44} />
            <div className={styles.heroText}>
              <div className={styles.heroRow}>
                <span className={styles.company}>{company.displayName}</span>
                <StatusBadge tone={job.overlap.count > 0 ? 'info' : 'neutral'}>{t('findJobs:card.overlap', { count: job.overlap.count, total: job.overlap.total })}</StatusBadge>
              </div>
              <p className={styles.posted}>{[company.industry, job.publishedAt && t('findJobs:details.posted', { time: format.relative(job.publishedAt) })].filter(Boolean).join(' · ')}</p>
            </div>
          </header>

          <h1 className={styles.title}>{job.title}</h1>

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
            {job.salary && <span className={styles.salary}>{jobText.salary(job)}</span>}
          </div>

          <SkillEvidence job={job} />

          {job.brief && (
            <section className={styles.section}>
              <h2 className={styles.h2}>{t('findJobs:details.about')}</h2>
              <p className={styles.about}>{job.brief}</p>
            </section>
          )}
          <ListSection title={t('findJobs:details.responsibilities')} items={job.responsibilities} />
          <SkillSection title={t('findJobs:details.requiredSkills')} skills={job.requiredSkills} />
          <SkillSection title={t('findJobs:details.preferredSkills')} skills={job.preferredSkills} />
          <ListSection title={t('findJobs:details.languages')} items={conditions} />
        </article>

        <aside className={styles.rail} aria-label={t('findJobs:details.railTitle')}>
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
              {job.application && <MessageCompanyButton job={job} fullWidth />}
            </div>
            {job.application && <p className={styles.railText}>{t('applications:apply.sent')}</p>}
          </section>

          <section className={styles.card}>
            <h2 className={styles.aboutTitle}>{t('findJobs:details.aboutCompany', { company: company.displayName })}</h2>
            {company.description && <p className={styles.aboutText}>{company.description}</p>}
            <ul className={styles.facts}>
              {company.industry && (
                <li>
                  <Icon as={Building2} size={13} />
                  {company.industry}
                </li>
              )}
              {company.size && (
                <li>
                  <Icon as={Users} size={13} />
                  {t(`enums:companySize.${company.size}`)}
                </li>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
