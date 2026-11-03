import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Button, Checkbox, Icon, Modal } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import styles from './ReviewSkillModal.module.css'

function ReviewBody({ skill, error, busy, onClose, onConfirm }) {
  const { t } = useTranslation('aiInsights')
  const [confirmed, setConfirmed] = useState(false)
  return (
    <div className={styles.body}>
      <p className={styles.text}>{t('review.text')}</p>
      <div className={styles.chips}>
        <PillBadge tone="accent">{skill}</PillBadge>
        <PillBadge>{t('review.chip')}</PillBadge>
      </div>
      <Checkbox className={styles.confirm} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} data-autofocus>
        {t('review.confirm', { skill })}
      </Checkbox>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="outline" onClick={onClose}>
          {t('review.keep')}
        </Button>
        <Button className={styles.add} disabled={!confirmed} loading={busy} onClick={() => onConfirm(skill)} rightIcon={<Icon as={Check} size={13} strokeWidth={2} />}>
          {t('review.add')}
        </Button>
      </div>
    </div>
  )
}

/** M-064: review before a skill is added to the profile; nothing changes until the candidate confirms. `skill` null = closed. */
export default function ReviewSkillModal({ skill, error, busy, onClose, onConfirm }) {
  const { t } = useTranslation('aiInsights')
  return (
    <Modal open={Boolean(skill)} onClose={onClose} title={skill ? t('review.title', { skill }) : ''} width={512} className={styles.dialog}>
      {skill && <ReviewBody key={skill} skill={skill} error={error} busy={busy} onClose={onClose} onConfirm={onConfirm} />}
    </Modal>
  )
}
