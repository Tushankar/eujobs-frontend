import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Sparkles } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Icon } from '@/components/ui'
import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'
import { checkUpload, serverFieldErrors, useErrorText, useUploadText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useConfirmContractRulesMutation, useLazyGetContractUrlQuery, useReadContractMutation, useRemoveContractMutation, useUploadContractMutation } from '../api.js'
import { RulesEditor } from './ContractRules.jsx'
import PdfButton from './PdfButton.jsx'
import styles from './ContractCard.module.css'

/**
 * 2026-11-20: an agency job's contract (optional): the PDF, AI's reading of its rules (Agency Plus) and the agency's
 * confirmation. Confirmed rules apply to this job's placements before the agreement's; a job with an unconfirmed
 * contract cannot be published. `error` is the wizard's "rules not confirmed" message.
 */
export default function ContractCard({ job, error }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const rule = config?.limits.uploads.agency_contract
  const uploadText = useUploadText(rule)
  const [upload, { isLoading: uploading }] = useUploadContractMutation()
  const [remove] = useRemoveContractMutation()
  const [read, { isLoading: reading }] = useReadContractMutation()
  const [confirm] = useConfirmContractRulesMutation()
  const [openUrl] = useLazyGetContractUrlQuery()
  const [busy, setBusy] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [problem, setProblem] = useState('')
  const contract = job.agency?.contract

  async function handleFile(file) {
    const key = checkUpload(file, rule)
    setProblem(key ? uploadText.problem(key, file) : '')
    if (!key) await upload({ jobId: job.id, file }).unwrap().catch((failure) => setProblem(errorText.code(failure)))
  }

  async function handleRead() {
    setProblem('')
    try {
      await read(job.id).unwrap()
    } catch (failure) {
      setProblem(serverFieldErrors(failure).file ? t('agency:agreement.noText') : errorText.code(failure))
    }
  }

  async function handleConfirm(rules) {
    setBusy('confirm')
    setFieldErrors({})
    setProblem('')
    try {
      await confirm({ jobId: job.id, rules }).unwrap()
    } catch (failure) {
      if (errorCode(failure) === 'VALIDATION_FAILED') setFieldErrors(serverFieldErrors(failure))
      else setProblem(errorText.code(failure))
    } finally {
      setBusy(null)
    }
  }

  async function handleOpen() {
    const { data } = await openUrl(job.id)
    if (data?.url) window.open(data.url, '_blank', 'noopener')
  }

  return (
    <section className={styles.card} data-contract-card>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>{t('agency:contract.title')}</h3>
          <p className={styles.lead}>{t('agency:contract.lead')}</p>
        </div>
        {contract && <PillBadge tone={contract.confirmedAt ? 'success' : 'warning'}>{t(contract.confirmedAt ? 'agency:contract.confirmed' : 'agency:contract.toConfirm')}</PillBadge>}
      </div>

      {contract ? (
        <>
          <div className={styles.fileRow}>
            <button type="button" className={styles.file} onClick={handleOpen}>
              <Icon as={FileText} size={14} />
              {contract.name}
            </button>
            <div className={styles.fileActions}>
              <PdfButton label={t('agency:agreement.replace')} onFile={handleFile} busy={uploading} />
              <button type="button" className={styles.linkDanger} onClick={() => remove(job.id).unwrap().catch((failure) => setProblem(errorText.code(failure)))}>
                {t('agency:contract.remove')}
              </button>
            </div>
          </div>
          <div className={styles.ai}>
            <p className={styles.aiText}>{contract.aiReadAt ? t('agency:agreement.aiDone', { when: format.dateTime(contract.aiReadAt) }) : t('agency:contract.aiText')}</p>
            <PlanButton entitlement="ai" roles={['agency']} variant="outline" size="sm" leftIcon={<Icon as={Sparkles} size={14} />} loading={reading} onClick={handleRead} data-read-contract>
              {t(contract.aiReadAt ? 'agency:agreement.readAgain' : 'agency:agreement.read')}
            </PlanButton>
          </div>
          <RulesEditor
            key={`${contract.uploadedAt}-${contract.aiReadAt ?? ''}`}
            rules={contract.rules}
            errors={fieldErrors}
            busy={busy}
            onSubmit={handleConfirm}
            actions={[{ intent: 'confirm', label: t(contract.confirmedAt ? 'agency:contract.confirmAgain' : 'agency:contract.confirm') }]}
          />
        </>
      ) : (
        <div className={styles.fileRow}>
          <span className={styles.none}>{t('agency:contract.none')}</span>
          <PdfButton label={t('agency:contract.attach')} onFile={handleFile} busy={uploading} />
        </div>
      )}
      {(problem || error) && (
        <p className={styles.problem} role="alert">
          {problem || error}
        </p>
      )}
    </section>
  )
}
