import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BriefcaseBusiness, Check } from 'lucide-react'
import { Button, Icon, Modal } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useOfferPlacementMutation } from '../../api.js'
import styles from './JobPicker.module.css'

/**
 * 2026-11-23 (owner: "Everyone on the books, I cannot hire him; on the job I can"): Offer placement straight from the
 * list of everyone on the books. Choose one of the agency's published jobs, then send; the server's rule check answers
 * here (a clashing placement, a new agreement version waiting). The "Offer sent!" modal follows on success.
 */
export default function OfferFromBooks({ member, jobs, onClose }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const [jobId, setJobId] = useState(jobs.length === 1 ? jobs[0].id : '')
  const [failure, setFailure] = useState(null)
  const [offer, { isLoading }] = useOfferPlacementMutation()
  const name = member.candidate.name ?? t('common:deletedUser')

  async function send() {
    setFailure(null)
    try {
      await offer({ jobId, candidateId: member.candidate.id }).unwrap()
      onClose()
    } catch (error) {
      setFailure(error)
    }
  }

  return (
    <Modal
      open
      title={t('agency:talent.offerTitle', { name })}
      description={t('agency:talent.offerText')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button loading={isLoading} disabled={!jobId} onClick={send} data-send-offer>
            {t('agency:placements.sendOffer')}
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label={t('agency:placements.job')} data-offer-jobs>
        {jobs.map((job) => (
          <button
            key={job.id}
            type="button"
            role="radio"
            aria-checked={job.id === jobId}
            className={cx(styles.option, job.id === jobId && styles.active)}
            onClick={() => setJobId(job.id)}
            data-offer-job={job.title}
          >
            <span className={styles.icon} aria-hidden="true">
              <Icon as={BriefcaseBusiness} size={16} />
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{job.title}</span>
              <span className={styles.meta}>{t('agency:placements.range', { start: format.date(job.agency.startDate), end: format.date(job.agency.endDate) })}</span>
            </span>
            {job.id === jobId && <Icon as={Check} size={16} className={styles.check} />}
          </button>
        ))}
      </div>
      {failure && (
        <p className={styles.failure} role="alert">
          {errorText.code(failure)}
        </p>
      )}
    </Modal>
  )
}
