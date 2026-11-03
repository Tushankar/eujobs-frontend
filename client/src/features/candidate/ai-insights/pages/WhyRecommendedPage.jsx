import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Check, ChevronDown, FileText, MessageSquare, ShieldCheck, Users } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import sparkle from '@/assets/icons/ai-sparkle-blue.svg'
import { useGetInsightPageQuery, useSaveExplanationFeedbackMutation } from '@/features/ai/api.js'
import { useGetProfileQuery } from '@/features/candidate/profile/api.js'
import { cx } from '@/utils/cx.js'
import AiPageShell from '../components/AiPageShell.jsx'
import Narrative from '../components/Narrative.jsx'
import RolePicker from '../components/RolePicker.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import SourceEvidenceModal from '../components/SourceEvidenceModal.jsx'
import { useChosenJob } from '../hooks/useChosenJob.js'
import styles from './WhyRecommendedPage.module.css'

const AI_INSIGHTS = '/candidate/ai-insights'
const SOURCES = [
  { key: 'profile', icon: Users },
  { key: 'job', icon: BriefcaseBusiness },
  { key: 'protected', icon: ShieldCheck },
]
const FEEDBACK = [
  { value: 'helpful', icon: Check },
  { value: 'needs_review', icon: MessageSquare },
]

/** Why recommended (M-057, M-067): three AI-written reasons grounded on code tags, what was not assessed, and feedback. */
export default function WhyRecommendedPage() {
  const { t } = useTranslation('aiInsights')
  const { roles, jobId, choose } = useChosenJob()
  const { data } = useGetInsightPageQuery({ page: 'why-recommended', jobId }, { skip: !jobId })
  const { data: profile } = useGetProfileQuery()
  const [saveFeedback, saving] = useSaveExplanationFeedbackMutation()
  const [sourceOpen, setSourceOpen] = useState(false)
  const [open, setOpen] = useState({ ordered: true })
  const evidence = data?.evidence
  const tags = evidence && [
    t('why.tags.skills', { count: evidence.requiredSkills - evidence.missingSkills.length, total: evidence.requiredSkills }),
    t('why.tags.experience'),
    t(evidence.workMode.met ? 'why.tags.workAligned' : 'why.tags.workReview'),
  ]
  const details = [
    { id: 'ordered', title: t('why.details.ordered'), body: [t('why.details.orderedText'), t('why.details.orderedNote')] },
    { id: 'notAssessed', title: t('why.details.notAssessed'), body: [t('why.details.notAssessedText')] },
    { id: 'change', title: t('why.details.change'), body: [t('why.details.changeText')], link: true },
  ]

  return (
    <AiPageShell eyebrow={t('why.eyebrow')} title={t('why.title')} description={t('why.description')}>
      <RolePicker roles={roles} jobId={jobId} onChange={choose} />

      {evidence && (
        <div className={styles.layout}>
          <div className={styles.main}>
            <Panel padding={24} aria-labelledby="why-title">
              <div className={styles.badges}>
                <PillBadge tone="primary">
                  <img src={sparkle} alt="" width={14} height={14} />
                  {t('why.badge')}
                </PillBadge>
                {data.rank && <PillBadge>{t('why.rank', { rank: data.rank })}</PillBadge>}
              </div>
              <SectionHeading id="why-title" className={styles.whyHeading} title={t('why.heading')} description={t('why.headingLead')} />
              <Narrative section="why" jobId={jobId}>
                {(narrative) => (
                  <ol className={styles.reasons}>
                    {narrative.reasons.slice(0, 3).map((reason, index) => (
                      <li key={reason.title} className={styles.reason}>
                        <span className={styles.index} aria-hidden="true">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h3 className={styles.reasonTitle}>{reason.title}</h3>
                          <p className={styles.reasonText}>{reason.text}</p>
                          <div className={styles.tagRow}>
                            <PillBadge>{tags[index]}</PillBadge>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Narrative>
            </Panel>

            <Panel padding="0 24px">
              <ul>
                {details.map((detail) => {
                  const expanded = Boolean(open[detail.id])
                  return (
                    <li key={detail.id} className={styles.detail}>
                      <h3>
                        <button
                          type="button"
                          className={styles.trigger}
                          aria-expanded={expanded}
                          aria-controls={`detail-${detail.id}`}
                          onClick={() => setOpen((previous) => ({ ...previous, [detail.id]: !previous[detail.id] }))}
                        >
                          {detail.title}
                          <Icon as={ChevronDown} size={16} strokeWidth={2} className={cx(styles.chevron, expanded && styles.chevronOpen)} />
                        </button>
                      </h3>
                      <div id={`detail-${detail.id}`} className={styles.detailBody} hidden={!expanded}>
                        {detail.body.map((text, index) => (
                          <p key={text} className={index ? styles.detailNote : styles.detailText}>
                            {text}
                          </p>
                        ))}
                        {detail.link && (
                          <Link to="/candidate/profile" className={styles.link}>
                            {t('why.details.reviewProfile')}
                            <Icon as={ArrowRight} size={13} strokeWidth={2} />
                          </Link>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <Panel padding={24} aria-labelledby="feedback-title">
              <SectionHeading id="feedback-title" title={t('why.feedback')} description={t('why.feedbackLead')} />
              <div className={styles.feedback}>
                {FEEDBACK.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    className={cx(styles.choice, data.feedback === option.value && styles.chosen)}
                    aria-pressed={data.feedback === option.value}
                    disabled={saving.isLoading}
                    data-feedback={option.value}
                    onClick={() => saveFeedback({ jobId, value: data.feedback === option.value ? null : option.value })}
                    leftIcon={<Icon as={option.icon} size={14} strokeWidth={2} />}
                  >
                    {t(option.value === 'helpful' ? 'why.helpful' : 'why.needsReview')}
                  </Button>
                ))}
              </div>
              <p className={styles.feedbackNote} role="status">
                {data.feedback ? t('why.feedbackSaved') : ''}
              </p>
            </Panel>
          </div>

          <aside className={styles.side} aria-label={t('why.sourceTitle')}>
            <Panel padding={24}>
              <h2 className={styles.title}>{t('why.sourceTitle')}</h2>
              <ul className={styles.sources}>
                {SOURCES.map((source) => (
                  <li key={source.key}>
                    <span className={styles.sourceIcon}>
                      <Icon as={source.icon} size={15} strokeWidth={2} />
                    </span>
                    {t(`why.sources.${source.key}`)}
                  </li>
                ))}
              </ul>
              <Button variant="outline" fullWidth onClick={() => setSourceOpen(true)} leftIcon={<Icon as={FileText} size={13} strokeWidth={2} />}>
                {t('why.inspect')}
              </Button>
            </Panel>
            <Panel className={styles.context} padding={24}>
              <PillBadge tone="primary" className={styles.frosted}>
                {t('why.contextBadge')}
              </PillBadge>
              <p className={styles.contextText}>{t('why.contextText')}</p>
              <Link to={`${AI_INSIGHTS}/job-match?jobId=${jobId}`} className={styles.link}>
                {t('why.complete')}
                <Icon as={ArrowRight} size={13} strokeWidth={2} />
              </Link>
            </Panel>
          </aside>
        </div>
      )}

      <SourceEvidenceModal open={sourceOpen} onClose={() => setSourceOpen(false)} job={data?.job} evidence={evidence} skills={profile?.skills ?? []} />
    </AiPageShell>
  )
}
