import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Check, ExternalLink, FileText, Layers, Upload } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import sparkle from '@/assets/icons/ai-insights-sparkle-12.svg'
import AiPageShell from '../components/AiPageShell.jsx'
import LearningPlanCard from '../components/LearningPlanCard.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import { IMPROVEMENTS, PROFILE_COMPLETENESS } from '../data/insights.js'
import { useLearningPlan } from '../hooks/useInsightsState.js'
import styles from './ImproveProfilePage.module.css'

const ICONS = { 'external-link': ExternalLink, 'file-text': FileText, layers: Layers, briefcase: BriefcaseBusiness, upload: Upload }

/** Improve profile: suggestions, not requirements. Each action opens the profile area to review; nothing is changed here. */
export default function ImproveProfilePage() {
  const { plan, toggle: togglePlan } = useLearningPlan()
  const { percent, provided, total } = PROFILE_COMPLETENESS

  return (
    <AiPageShell
      eyebrow="Profile Improvement"
      title="Give your experience a clearer voice."
      description="Small, thoughtful improvements. Every change reviewed and approved by you."
    >
      <Panel className={styles.hero} padding={32}>
        <div className={styles.heroText}>
          <div className={styles.badgeRow}>
            <PillBadge tone="primary">
              <img src={sparkle} alt="" width={12} height={12} />
              A profile you can stand behind
            </PillBadge>
          </div>
          <h2 className={styles.heroTitle}>More context. More meaningful conversations.</h2>
          <p className={styles.heroCopy}>
            Profile completeness measures fields you’ve provided, not your ability or employability. Focus on accurate evidence—not
            chasing a perfect score.
          </p>
        </div>
        <div className={styles.completeness}>
          <p className={styles.completenessLabel}>Profile completeness</p>
          <p className={styles.percent}>
            {percent}
            <span>%</span>
          </p>
          <div className={styles.bar} role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <span className={styles.fill} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.completenessLabel}>
            {provided} of {total} core areas provided
          </p>
        </div>
      </Panel>

      <SectionHeading
        className={styles.heading}
        title="Your next useful improvements"
        description="Suggestions, not requirements. Start where you can add meaningful evidence."
      />
      <ul className={styles.grid}>
        {IMPROVEMENTS.map((item) => (
          <li key={item.id}>
            <Panel as="article" padding={24} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.iconBox}>
                  <Icon as={ICONS[item.icon]} size={20} strokeWidth={2} />
                </span>
                {item.status === 'worth-adding' ? (
                  <PillBadge tone="warning">Worth adding</PillBadge>
                ) : (
                  <PillBadge tone="success">
                    <Icon as={Check} size={11} strokeWidth={2} />
                    Provided · Can refine
                  </PillBadge>
                )}
              </div>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardText}>{item.description}</p>
              <Button
                as={Link}
                to={item.action.to}
                variant={item.action.primary ? 'primary' : 'outline'}
                className={styles.cardAction}
                rightIcon={<Icon as={ArrowRight} size={13} strokeWidth={2} />}
              >
                {item.action.label}
              </Button>
            </Panel>
          </li>
        ))}
      </ul>

      <div className={styles.plan}>
        <LearningPlanCard plan={plan} onRemove={togglePlan} exploreLabel="Explore skill gaps" exploreTo="/candidate/ai-insights/skill-gap" />
      </div>
    </AiPageShell>
  )
}
