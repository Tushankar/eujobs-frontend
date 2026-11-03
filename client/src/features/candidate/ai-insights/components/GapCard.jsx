import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, GraduationCap, Plus, Undo2 } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import styles from './GapCard.module.css'

/**
 * A required skill the profile does not list (M-064). The candidate decides: review and add it, plan to learn it
 * (P9-Q2), or leave the profile unchanged. An added skill stays visible here with an undo. `guidance` is the AI tip.
 */
export default function GapCard({ skill, guidance, added, planned, onReview, onUndo, onTogglePlan }) {
  const { t } = useTranslation('aiInsights')
  return (
    <Panel as="article" padding={24} className={styles.card} data-gap={skill}>
      <div className={styles.head}>
        <h3 className={styles.title}>{skill}</h3>
        {added ? (
          <PillBadge tone="success">
            <Icon as={Check} size={11} strokeWidth={2} />
            {t('gap.added')}
          </PillBadge>
        ) : (
          <PillBadge tone="warning">{t('gap.notListed')}</PillBadge>
        )}
      </div>
      {added ? (
        <p className={styles.text}>{t('gap.addedText', { skill })}</p>
      ) : (
        <>
          <p className={styles.text}>{t('gap.text', { skill })}</p>
          {guidance && (
            <div className={styles.tip}>
              <p className={styles.tipTitle}>{t('gap.tip')}</p>
              <p className={styles.tipText}>{guidance}</p>
            </div>
          )}
        </>
      )}
      <div className={styles.actions}>
        {added ? (
          <>
            <Button variant="outline" onClick={() => onUndo(skill)} leftIcon={<Icon as={Undo2} size={13} strokeWidth={2} />}>
              {t('gap.undo')}
            </Button>
            <Button as={Link} to="/candidate/profile" variant="ghost" className={styles.quiet} rightIcon={<Icon as={ArrowRight} size={13} strokeWidth={2} />}>
              {t('gap.review')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => onReview(skill)} rightIcon={<Icon as={Plus} size={13} strokeWidth={2} />}>
              {t('gap.have')}
            </Button>
            <Button
              variant="ghost"
              className={styles.quiet}
              aria-pressed={planned}
              data-plan-toggle={skill}
              onClick={() => onTogglePlan(skill)}
              rightIcon={<Icon as={planned ? Check : ArrowRight} size={13} strokeWidth={2} />}
            >
              {t(planned ? 'gap.planned' : 'gap.plan')}
            </Button>
            <Button as={Link} to="/candidate/learning" variant="ghost" className={styles.quiet} rightIcon={<Icon as={GraduationCap} size={13} strokeWidth={2} />}>
              {t('gap.course')}
            </Button>
          </>
        )}
      </div>
    </Panel>
  )
}
