import { useTranslation } from 'react-i18next'
import { Check, Download, FileText, GitCompare, Sparkles, Trash2 } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import AiButton from '@/features/ai/components/AiButton.jsx'
import { useFormat } from '@/lib/preferences.js'
import styles from './VersionRow.module.css'

/**
 * One CV version (M-028): any version can be downloaded; non-live ones can be set live or deleted. A version with
 * readable text has the AI actions (Plus, M-027, M-061): a snapshot proposal to review and confirm, and assisted drafts.
 * A version with a snapshot can be compared with another one.
 */
export default function VersionRow({ version, comparing, busy, onSetLive, onDownload, onDelete, onToggleCompare, onPropose, onReview, onDraft, onDeleteDraft }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { number, snapshot, pendingSnapshot } = version
  const line = (key, value) => t(key, { role: value.role, years: value.years, skills: format.list(value.skills) })
  return (
    <article className={styles.row} data-version={number}>
      <span className={styles.tile}>
        <Icon as={FileText} size={18} />
      </span>
      <div className={styles.body}>
        <div className={styles.titleLine}>
          <h3 className={styles.title}>{t('cv:version.title', { number, name: version.originalName })}</h3>
        </div>
        <div className={styles.status}>
          {version.live && (
            <PillBadge tone="success" dot>
              {t('cv:version.live')}
            </PillBadge>
          )}
          {version.noReadableText && <PillBadge tone="warning">{t('cv:version.noText')}</PillBadge>}
        </div>
        <p className={styles.meta}>{t('cv:version.meta', { date: format.dateTime(version.createdAt), size: format.fileSize(version.size) })}</p>
        {version.noReadableText && <p className={styles.note}>{t('cv:version.noTextHint')}</p>}
        {snapshot && <p className={styles.note}>{line('cv:version.snapshotLine', snapshot)}</p>}
        {pendingSnapshot && (
          <div className={styles.ai} data-pending-snapshot>
            <p className={styles.aiText}>{line('cv:snapshot.pending', pendingSnapshot)}</p>
            <p className={styles.note}>{t('cv:snapshot.pendingLead')}</p>
            <Button size="sm" onClick={onReview} data-review-snapshot>
              {t('cv:snapshot.review')}
            </Button>
          </div>
        )}
        {version.drafts.map((draft) => (
          <div key={draft.id} className={styles.ai} data-draft={draft.id}>
            <p className={styles.aiTitle}>{t('cv:draft.title', { date: format.dateTime(draft.createdAt) })}</p>
            <p className={styles.note}>{t('cv:draft.lead')}</p>
            <ul className={styles.suggestions}>
              {draft.suggestions.map((suggestion) => (
                <li key={suggestion}>{suggestion}</li>
              ))}
            </ul>
            <p className={styles.aiText}>{line('cv:draft.revised', draft.revisedSnapshot)}</p>
            <Button variant="outline" size="sm" leftIcon={<Icon as={Trash2} size={13} />} onClick={() => onDeleteDraft(draft)}>
              {t('cv:draft.delete')}
            </Button>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <Button variant="outline" aria-label={t('cv:version.downloadLabel', { number })} leftIcon={<Icon as={Download} size={13} />} onClick={onDownload}>
          {t('cv:version.download')}
        </Button>
        {!version.live && (
          <>
            <Button aria-label={t('cv:version.setLiveLabel', { number })} leftIcon={<Icon as={Check} size={13} />} onClick={onSetLive}>
              {t('cv:version.setLive')}
            </Button>
            <Button variant="outline" aria-label={t('cv:version.deleteLabel', { number })} leftIcon={<Icon as={Trash2} size={13} />} onClick={onDelete}>
              {t('cv:version.delete')}
            </Button>
          </>
        )}
        {!version.noReadableText && (
          <>
            {!snapshot && !pendingSnapshot && (
              <AiButton variant="outline" aria-label={t('cv:snapshot.proposeLabel', { number })} leftIcon={<Icon as={Sparkles} size={13} />} loading={busy === 'snapshot'} onClick={onPropose} data-propose-snapshot>
                {t('cv:snapshot.propose')}
              </AiButton>
            )}
            <AiButton variant="outline" aria-label={t('cv:draft.createLabel', { number })} leftIcon={<Icon as={Sparkles} size={13} />} loading={busy === 'draft'} onClick={onDraft} data-create-draft>
              {t('cv:draft.create')}
            </AiButton>
          </>
        )}
        {(snapshot || pendingSnapshot) && (
          <Button
            variant={comparing ? 'secondary' : 'ghost'}
            aria-pressed={comparing}
            aria-label={t('cv:version.compareLabel', { number })}
            leftIcon={<Icon as={GitCompare} size={13} />}
            onClick={onToggleCompare}
            data-compare={number}
          >
            {t('cv:version.compare')}
          </Button>
        )}
      </div>
    </article>
  )
}
