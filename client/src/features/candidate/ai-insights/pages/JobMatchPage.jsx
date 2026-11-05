import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Bookmark, BookmarkCheck, Check, FileText } from 'lucide-react'
import { Button, Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useGetInsightPageQuery } from '@/features/ai/api.js'
import { useSaveToggle } from '@/features/candidate/jobs/api.js'
import MatchBadge from '@/features/candidate/jobs/components/MatchBadge.jsx'
import { useGetProfileQuery } from '@/features/candidate/profile/api.js'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import AiPageShell from '../components/AiPageShell.jsx'
import Narrative from '../components/Narrative.jsx'
import RolePicker from '../components/RolePicker.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import SourceEvidenceModal from '../components/SourceEvidenceModal.jsx'
import { useChosenJob } from '../hooks/useChosenJob.js'
import styles from './JobMatchPage.module.css'

const AI_INSIGHTS = '/candidate/ai-insights'

function AlignmentBadge({ aligned, label }) {
  return aligned ? (
    <PillBadge tone="success">
      <Icon as={Check} size={11} strokeWidth={2} />
      {label}
    </PillBadge>
  ) : (
    <PillBadge tone="warning">{label}</PillBadge>
  )
}

/** Job match (M-057, M-065): the code evidence side by side, the AI narrative, and "Save this opportunity". */
export default function JobMatchPage() {
  const { t } = useTranslation('aiInsights')
  const format = useFormat()
  const jobText = useJobText()
  const { roles, jobId, choose, loading: rolesLoading } = useChosenJob()
  const page = useGetInsightPageQuery({ page: 'job-match', jobId }, { skip: !jobId })
  const { data, refetch } = page
  const busy = page.isFetching && !page.currentData
  const { data: profile } = useGetProfileQuery()
  const toggleSave = useSaveToggle()
  const [sourceOpen, setSourceOpen] = useState(false)
  const job = data?.job
  const evidence = data?.evidence
  const mode = (key) => (key ? t(`enums:workPreference.${key}`) : '—')
  const level = (key) => t(`enums:languageLevel.${key}`)

  const rows = evidence && [
    ...job.requiredSkills.map((skill) => {
      const listed = !evidence.missingSkills.includes(skill)
      return { key: `skill-${skill}`, label: skill, aligned: listed, status: t(listed ? 'jobMatch.listed' : 'jobMatch.notListed'), profile: listed ? skill : t('jobMatch.notListedValue'), requirement: skill }
    }),
    {
      key: 'experience',
      label: t('jobMatch.rows.experience'),
      aligned: evidence.years.met,
      status: t(evidence.years.met ? 'jobMatch.aligned' : 'jobMatch.toReview'),
      profile: t('jobMatch.experienceValue', { count: evidence.years.candidate ?? 0 }),
      requirement: evidence.years.required == null ? t('jobMatch.noMinimum') : t('source.requiredYearsValue', { count: evidence.years.required }),
    },
    { key: 'work', label: t('jobMatch.rows.work'), aligned: evidence.workMode.met, status: t(evidence.workMode.met ? 'jobMatch.aligned' : 'jobMatch.toReview'), profile: mode(evidence.workMode.candidate), requirement: mode(evidence.workMode.job) },
    {
      key: 'location',
      label: t('jobMatch.rows.location'),
      aligned: evidence.location.met,
      status: t(evidence.location.met ? 'jobMatch.aligned' : 'jobMatch.toReview'),
      profile: evidence.location.countryCode ? format.country(evidence.location.countryCode) : '—',
      requirement: jobText.place(job),
    },
    ...(evidence.rightToWork === null
      ? []
      : [
          {
            key: 'rtw',
            label: t('jobMatch.rows.rightToWork'),
            aligned: evidence.rightToWork,
            status: t(evidence.rightToWork ? 'jobMatch.aligned' : 'jobMatch.toReview'),
            profile: t(evidence.rightToWork ? 'jobMatch.rightToWorkYes' : 'jobMatch.rightToWorkNo'),
            requirement: t('jobMatch.rightToWorkRequirement', { country: format.country(job.country) }),
          },
        ]),
    ...evidence.languages.map((language) => ({
      key: `language-${language.code}`,
      label: format.languageName(language.code),
      aligned: language.met,
      status: t(language.met ? 'jobMatch.aligned' : 'jobMatch.toReview'),
      profile: language.level ? level(language.level) : t('jobMatch.notListedValue'),
      requirement: level(language.minLevel),
    })),
  ]

  async function handleSave() {
    await toggleSave(job)
    refetch()
  }

  return (
    <AiPageShell eyebrow={t('jobMatch.eyebrow')} title={t('jobMatch.title')} description={t('jobMatch.description')}>
      <RolePicker roles={roles} jobId={jobId} onChange={choose} loading={rolesLoading} />

      {(rolesLoading || page.isLoading) && <JobMatchSkeleton />}
      {evidence && (
        <div className={cx(styles.layout, busy && styles.busy)} aria-busy={busy || undefined}>
          <div className={styles.main}>
            <Panel padding={24} aria-labelledby="fit-title">
              <div className={styles.fitHead}>
                <SectionHeading id="fit-title" className={styles.fitTitle} title={t('jobMatch.fit')} description={t('jobMatch.fitLead')} />
                <MatchBadge job={job} />
              </div>
              <ul className={styles.tiles}>
                <li className={styles.tile}>
                  <p className={styles.tileLabel}>{t('jobMatch.skills')}</p>
                  <p className={styles.tileValue}>{t('jobMatch.skillsValue', { count: evidence.requiredSkills - evidence.missingSkills.length, total: evidence.requiredSkills })}</p>
                  <AlignmentBadge aligned={!evidence.missingSkills.length} label={t(evidence.missingSkills.length ? 'jobMatch.toReview' : 'jobMatch.aligned')} />
                </li>
                <li className={styles.tile}>
                  <p className={styles.tileLabel}>{t('jobMatch.experience')}</p>
                  <p className={styles.tileValue}>{t('jobMatch.experienceValue', { count: evidence.years.candidate ?? 0 })}</p>
                  <AlignmentBadge aligned={evidence.years.met} label={t(evidence.years.met ? 'jobMatch.aligned' : 'jobMatch.toReview')} />
                </li>
                <li className={styles.tile}>
                  <p className={styles.tileLabel}>{t('jobMatch.work')}</p>
                  <p className={styles.tileValue}>
                    {mode(evidence.workMode.candidate)} → {mode(evidence.workMode.job)}
                  </p>
                  <AlignmentBadge aligned={evidence.workMode.met} label={t(evidence.workMode.met ? 'jobMatch.aligned' : 'jobMatch.toReview')} />
                </li>
              </ul>
            </Panel>

            <Panel padding={24} aria-labelledby="evidence-title">
              <div className={styles.evidenceHead}>
                <h2 className={styles.title} id="evidence-title">
                  {t('jobMatch.evidence')}
                </h2>
                <Button variant="ghost" className={styles.quiet} onClick={() => setSourceOpen(true)} leftIcon={<Icon as={FileText} size={13} strokeWidth={2} />}>
                  {t('jobMatch.viewSource')}
                </Button>
              </div>
              <ul className={styles.rows}>
                {rows.map((row) => (
                  <li key={row.key} className={styles.row}>
                    <div className={styles.rowLabel}>
                      <p className={styles.rowName}>{row.label}</p>
                      <AlignmentBadge aligned={row.aligned} label={row.status} />
                    </div>
                    <dl className={styles.rowValue}>
                      <dt>{t('jobMatch.yours')}</dt>
                      <dd>{row.profile}</dd>
                    </dl>
                    <dl className={styles.rowValue}>
                      <dt>{t('jobMatch.requirement')}</dt>
                      <dd>{row.requirement}</dd>
                    </dl>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel padding={24} aria-labelledby="gaps-title">
              <SectionHeading id="gaps-title" title={t('jobMatch.gaps')} description={t('jobMatch.gapsLead')} />
              <Narrative section="job_match" jobId={jobId}>
                {(narrative) => (
                  <div className={styles.gapText}>
                    <p>{narrative.summary}</p>
                    {narrative.gaps.length > 0 && (
                      <ul>
                        {narrative.gaps.map((gap) => (
                          <li key={gap}>{gap}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Narrative>
              <Link to={`${AI_INSIGHTS}/skill-gap?jobId=${jobId}`} className={styles.link}>
                {t('jobMatch.skillGap')}
                <Icon as={ArrowRight} size={13} strokeWidth={2} />
              </Link>
            </Panel>
          </div>

          <aside className={`${styles.side} sticky-side`} aria-label={t('jobMatch.nextTitle')}>
            <Panel padding={24}>
              <h2 className={styles.title}>{t('jobMatch.nextTitle')}</h2>
              <p className={styles.sideText}>{t('jobMatch.nextText')}</p>
              <div className={styles.sideActions}>
                <Button as={Link} to={`/candidate/jobs/${jobId}`} fullWidth rightIcon={<Icon as={ArrowUpRight} size={13} strokeWidth={2} />}>
                  {t('jobMatch.view')}
                </Button>
                <Button variant="outline" fullWidth aria-pressed={job.saved} data-save-job onClick={handleSave} leftIcon={<Icon as={job.saved ? BookmarkCheck : Bookmark} size={13} strokeWidth={2} />}>
                  {t(job.saved ? 'jobMatch.saved' : 'jobMatch.save')}
                </Button>
                <Link to={`${AI_INSIGHTS}/why-recommended?jobId=${jobId}`} className={styles.centerLink}>
                  {t('jobMatch.why')}
                  <Icon as={ArrowRight} size={13} strokeWidth={2} />
                </Link>
              </div>
            </Panel>
            <Panel className={styles.context} padding={24}>
              <h2 className={styles.title}>{t('jobMatch.contextTitle')}</h2>
              <p className={styles.contextText}>{t('jobMatch.contextText')}</p>
            </Panel>
          </aside>
        </div>
      )}

      <SourceEvidenceModal open={sourceOpen} onClose={() => setSourceOpen(false)} job={job} evidence={evidence} skills={profile?.skills ?? []} />
    </AiPageShell>
  )
}

/** The side-by-side layout while the role's evidence loads: the real headings and labels, placeholders for the values. */
function JobMatchSkeleton() {
  const { t } = useTranslation('aiInsights')
  return (
    <div className={styles.layout}>
      <SkeletonRegion className={styles.main}>
        <Panel padding={24}>
          <div className={styles.fitHead}>
            <SectionHeading className={styles.fitTitle} title={t('jobMatch.fit')} description={t('jobMatch.fitLead')} />
            <Skeleton shape="pill" width={110} />
          </div>
          <ul className={styles.tiles}>
            {['skills', 'experience', 'work'].map((key) => (
              <li key={key} className={styles.tile}>
                <p className={styles.tileLabel}>{t(`jobMatch.${key}`)}</p>
                <p className={styles.tileValue}>
                  <Skeleton width={96} height={12} />
                </p>
                <Skeleton shape="pill" />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel padding={24}>
          <h2 className={styles.title}>{t('jobMatch.evidence')}</h2>
          <ul className={styles.rows}>
            {[80, 64, 96, 72].map((width) => (
              <li key={width} className={styles.row}>
                <div className={styles.rowLabel}>
                  <Skeleton width={width} />
                  <Skeleton shape="pill" />
                </div>
                <dl className={styles.rowValue}>
                  <dt>{t('jobMatch.yours')}</dt>
                  <dd>
                    <Skeleton width={width + 20} />
                  </dd>
                </dl>
                <dl className={styles.rowValue}>
                  <dt>{t('jobMatch.requirement')}</dt>
                  <dd>
                    <Skeleton width={width + 40} />
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel padding={24}>
          <SectionHeading title={t('jobMatch.gaps')} description={t('jobMatch.gapsLead')} />
          <div className={styles.gapSkeleton}>
            <Skeleton />
            <Skeleton width="92%" />
            <Skeleton width="64%" />
          </div>
        </Panel>
      </SkeletonRegion>

      <aside className={`${styles.side} sticky-side`}>
        <Panel padding={24}>
          <h2 className={styles.title}>{t('jobMatch.nextTitle')}</h2>
          <p className={styles.sideText}>{t('jobMatch.nextText')}</p>
          <div className={styles.sideActions}>
            <Skeleton shape="pill" width="100%" height={40} />
            <Skeleton shape="pill" width="100%" height={40} />
            <div className={styles.centerLink}>
              <Skeleton width={170} />
            </div>
          </div>
        </Panel>
        <Panel className={styles.context} padding={24}>
          <h2 className={styles.title}>{t('jobMatch.contextTitle')}</h2>
          <p className={styles.contextText}>{t('jobMatch.contextText')}</p>
        </Panel>
      </aside>
    </div>
  )
}
