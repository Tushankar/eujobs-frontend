import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, EyeOff } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Avatar, Checkbox, CompanyLogo } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useDecideContentCaseMutation, useGetContentCaseQuery } from '../api.js'
import { CASE_TONES } from '../tones.js'
import ReviewDialog from './ReviewDialog.jsx'
import styles from './ReviewDetails.module.css'
import own from './ContentReview.module.css'

/** The reported job, profile or company as it is now; a message case shows its stored excerpt instead (OQ-1). */
function Target({ item }) {
  const { t } = useTranslation(['moderation', 'enums'])
  const format = useFormat()
  const { target } = item
  if (item.targetType === 'message') {
    return (
      <ol className={own.excerpt} aria-label={t('content.excerpt')}>
        {item.excerpt.map((message, index) => (
          <li key={index} className={cx(own.message, message.reported && own.reported)} data-excerpt-reported={message.reported || undefined}>
            <span className={own.sender}>
              {t(`enums:role.${message.senderRole}`)} · {format.dateTime(message.at)}
              {message.reported && ` · ${t('content.reportedMessage')}`}
            </span>
            <p>{message.body}</p>
          </li>
        ))}
      </ol>
    )
  }
  if (!target) return <p className={styles.contextText}>{t('content.targetGone')}</p>
  const facts =
    item.targetType === 'job'
      ? [
          ['company', target.company],
          ['status', t(`enums:jobStatus.${target.status}`) + (target.restricted ? ` · ${t('enums:caseStatus.restricted')}` : '')],
        ]
      : item.targetType === 'candidate_profile'
        ? [
            ['headline', target.headline],
            ['visibility', t(target.restricted ? 'content.hidden' : 'content.visible')],
          ]
        : []
  const text = target.brief ?? target.about ?? target.description
  return (
    <>
      {item.targetType === 'candidate_profile' && <Avatar name={target.name} src={target.photoUrl ?? undefined} size={48} />}
      {item.targetType === 'job' && target.company && <CompanyLogo name={target.company} id={target.companyId} src={target.companyLogoUrl ?? undefined} size={48} />}
      {item.targetType === 'company' && <CompanyLogo name={target.name} id={target.id} src={target.logoUrl ?? undefined} size={48} />}
      <dl className={styles.facts}>
        {facts.map(([key, value]) => (
          <div key={key} className={own.fact}>
            <dt>{t(`content.facts.${key}`)}</dt>
            <dd>{value || t('content.notProvided')}</dd>
          </div>
        ))}
      </dl>
      {text && <p className={cx(styles.contextText, own.clamp)}>{text}</p>}
    </>
  )
}

/** Moderation › Content: one case with its reports, the target, the history and the decisions it allows (M-167). */
export default function ContentReview({ id, onDecided, onClose }) {
  const { t } = useTranslation(['moderation', 'enums'])
  const format = useFormat()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { data: item } = useGetContentCaseQuery(id)
  const [decide, decision] = useDecideContentCaseMutation()
  const [removePhoto, setRemovePhoto] = useState(false)
  if (!item) return null

  const lifting = item.status === 'restricted'
  const kind = t(`enums:reportTargetType.${item.targetType}`)
  const actions = item.actions.map((action) =>
    action === 'restrict'
      ? {
          id: 'restrict',
          label: t('content.restrict'),
          icon: EyeOff,
          variant: 'danger',
          reasonRequired: true,
          confirmTitle: t('content.restrictTitle'),
          confirmText: t(`content.restrictText.${item.targetType}`),
          confirmLabel: t('content.restrict'),
        }
      : {
          id: 'dismiss',
          label: t(lifting ? 'content.lift' : 'content.dismiss'),
          icon: Check,
          variant: 'outline',
          confirmTitle: t(lifting ? 'content.liftTitle' : 'content.dismissTitle'),
          confirmText: t(lifting ? `content.liftText.${item.targetType}` : 'content.dismissText'),
          confirmLabel: t(lifting ? 'content.lift' : 'content.dismiss'),
        },
  )

  async function handleDecide(action, reason) {
    try {
      await decide({ id, action: action.id, reason, removePhoto: action.id === 'restrict' && removePhoto }).unwrap()
      onDecided(t(`content.decided.${action.id === 'restrict' ? 'restricted' : lifting ? 'lifted' : 'dismissed'}`, { name: item.targetName }))
    } catch {
      // The dialog shows the failure.
    }
  }

  return (
    <ReviewDialog
      title={t('content.reviewTitle')}
      actions={actions}
      maxReason={config?.limits.moderationReason.max}
      busy={decision.isLoading}
      error={decision.error && errorText.code(decision.error)}
      extra={(action) =>
        action.id === 'restrict' &&
        item.target?.photoUrl && (
          <Checkbox className={own.photo} checked={removePhoto} onChange={(event) => setRemovePhoto(event.target.checked)} name="removePhoto">
            {t('content.removePhoto')}
          </Checkbox>
        )
      }
      onDecide={handleDecide}
      onClose={onClose}
    >
      <div className={styles.badges}>
        <PillBadge tone="accent">{kind}</PillBadge>
        <PillBadge tone={item.priority === 'high' ? 'warning' : 'neutral'}>{t(`content.priority.${item.priority}`)}</PillBadge>
        <PillBadge tone={CASE_TONES[item.status]}>{t(`enums:caseStatus.${item.status}`)}</PillBadge>
      </div>
      <h3 className={styles.title}>{item.targetName}</h3>
      <p className={styles.subtitle}>
        {item.openedBy === 'admin' ? t('content.openedFromJobs') : t('content.reportCount', { count: item.reportCount })} · {format.dateTime(item.reportedAt)}
      </p>

      <section className={styles.context} aria-label={t('content.reports')}>
        <p className={styles.eyebrow}>{t('content.reports')}</p>
        <ul className={own.reports}>
          {item.reports.map((report, index) => (
            <li key={index}>
              <p className={own.reportLine}>
                <strong>{t(`enums:reportReason.${report.reason}`)}</strong> · {report.reporter ? `${report.reporter.name} (${t(`enums:role.${report.reporter.role}`)})` : t('content.unknownReporter')} ·{' '}
                {format.dateTime(report.at)}
              </p>
              {report.details && <p className={own.details}>{report.details}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.context} aria-label={kind}>
        <p className={styles.eyebrow}>{item.targetType === 'message' ? t('content.excerpt') : kind}</p>
        <Target item={item} />
      </section>

      {item.history.length > 1 && (
        <section className={styles.context} aria-label={t('content.history')}>
          <p className={styles.eyebrow}>{t('content.history')}</p>
          <ol className={own.history}>
            {item.history.slice(1).map((step, index) => (
              <li key={index}>
                {t(`content.step.${step.action}`, { by: step.by ?? '', date: format.dateTime(step.at) })}
                {step.reason && ` · ${step.reason}`}
                {step.photoRemoved && ` · ${t('content.photoRemoved')}`}
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className={styles.notice}>{t(item.actions.includes('restrict') || lifting ? 'content.notice' : 'content.noticeDismissOnly')}</p>
    </ReviewDialog>
  )
}
