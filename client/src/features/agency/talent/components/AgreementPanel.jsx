import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Sparkles, Upload } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import GetStartedCard from '@/components/common/GetStartedCard.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'
import { checkUpload, serverFieldErrors, useErrorText, useUploadText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useDeleteAgreementDraftMutation, useGetAgreementQuery, usePublishAgreementMutation, useReadAgreementMutation, useSaveAgreementRulesMutation, useUploadAgreementMutation } from '../../api.js'
import { RulesEditor, RulesList } from '../../components/ContractRules.jsx'
import styles from './AgreementPanel.module.css'

/** A PDF picker drawn as a button (the input covers it). */
export function PdfButton({ label, onFile, busy, variant = 'outline' }) {
  return (
    <label className={`${styles.pdfButton} ${styles[variant]}`} aria-busy={busy || undefined}>
      <input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) onFile(file)
      }} />
      <Icon as={Upload} size={14} />
      {label}
    </label>
  )
}

/** The PDF of a version: its name, opened in a new tab. */
function FileLink({ file }) {
  return file.url ? (
    <a className={styles.file} href={file.url} target="_blank" rel="noreferrer">
      <Icon as={FileText} size={14} />
      {file.name}
    </a>
  ) : (
    <span className={styles.file}>
      <Icon as={FileText} size={14} />
      {file.name}
    </span>
  )
}

/** 2026-11-20: Talent › Agreement: the current version, a draft of the next one (AI reads it on Agency Plus) and earlier ones. */
export default function AgreementPanel() {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const rule = config?.limits.uploads.agency_agreement
  const uploadText = useUploadText(rule)
  const { data, isLoading } = useGetAgreementQuery()
  const [upload, { isLoading: uploading }] = useUploadAgreementMutation()
  const [read, { isLoading: reading }] = useReadAgreementMutation()
  const [saveRules] = useSaveAgreementRulesMutation()
  const [publish] = usePublishAgreementMutation()
  const [deleteDraft] = useDeleteAgreementDraftMutation()
  const [busy, setBusy] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [problem, setProblem] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleFile(file) {
    const key = checkUpload(file, rule)
    setNotice('')
    setProblem(key ? uploadText.problem(key, file) : '')
    if (!key) await upload(file).unwrap().catch((error) => setProblem(errorText.code(error)))
  }

  async function handleRead() {
    setProblem('')
    setNotice('')
    try {
      await read().unwrap()
      setNotice(t('agency:agreement.readDone'))
    } catch (error) {
      const fields = serverFieldErrors(error)
      setProblem(fields.file ? t('agency:agreement.noText') : errorText.code(error))
    }
  }

  async function handleRules(body, intent) {
    setBusy(intent)
    setFieldErrors({})
    setProblem('')
    setNotice('')
    try {
      await saveRules(body).unwrap()
      if (intent === 'publish') {
        await publish().unwrap()
        setNotice(t('agency:agreement.published'))
      } else setNotice(t('agency:agreement.saved'))
    } catch (error) {
      if (errorCode(error) === 'VALIDATION_FAILED') setFieldErrors(error.data.error.fields ?? {})
      else setProblem(errorText.code(error))
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return (
      <SkeletonRegion className={styles.stack}>
        <Skeleton shape="block" height={220} />
      </SkeletonRegion>
    )
  }

  const { current, draft, earlier = [] } = data ?? {}
  const messages = (
    <>
      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
    </>
  )

  if (!current && !draft) {
    return (
      <div className={styles.stack}>
        <GetStartedCard
          id="agreement-start-title"
          title={t('agency:agreement.start.title')}
          text={t('agency:agreement.start.text')}
          steps={t('agency:agreement.start.steps', { returnObjects: true })}
          action={<PdfButton variant="primary" label={t('agency:agreement.upload')} onFile={handleFile} busy={uploading} />}
        />
        {messages}
      </div>
    )
  }

  return (
    <div className={styles.stack}>
      {messages}
      {draft && (
        <Panel className={styles.card} data-agreement-draft>
          <div className={styles.head}>
            <div>
              <h2 className={styles.title}>{t('agency:agreement.draftTitle', { version: draft.version })}</h2>
              <p className={styles.lead}>{t('agency:agreement.draftLead')}</p>
            </div>
            <PillBadge tone="warning">{t('enums:agreementStatus.draft')}</PillBadge>
          </div>
          <div className={styles.fileRow}>
            <FileLink file={draft.file} />
            <div className={styles.fileActions}>
              <PdfButton label={t('agency:agreement.replace')} onFile={handleFile} busy={uploading} />
              <button type="button" className={styles.linkDanger} onClick={() => setConfirmDelete(true)}>
                {t('agency:agreement.deleteDraft')}
              </button>
            </div>
          </div>
          <div className={styles.ai}>
            <div>
              <p className={styles.aiTitle}>{t('agency:agreement.aiTitle')}</p>
              <p className={styles.aiText}>{draft.aiReadAt ? t('agency:agreement.aiDone', { when: format.dateTime(draft.aiReadAt) }) : t('agency:agreement.aiText')}</p>
            </div>
            <PlanButton entitlement="ai" roles={['agency']} variant="outline" leftIcon={<Icon as={Sparkles} size={14} />} loading={reading} onClick={handleRead} data-read-agreement>
              {t(draft.aiReadAt ? 'agency:agreement.readAgain' : 'agency:agreement.read')}
            </PlanButton>
          </div>
          <RulesEditor
            key={`${draft.version}-${draft.aiReadAt ?? draft.createdAt}`}
            rules={draft.rules}
            errors={fieldErrors}
            busy={busy}
            onSubmit={handleRules}
            actions={[
              { intent: 'save', label: t('agency:agreement.saveRules') },
              { intent: 'publish', label: t('agency:agreement.publish', { version: draft.version }) },
            ]}
          />
        </Panel>
      )}

      {current && (
        <Panel className={styles.card} data-agreement-current>
          <div className={styles.head}>
            <div>
              <h2 className={styles.title}>{t('agency:agreement.currentTitle', { version: current.version })}</h2>
              <p className={styles.lead}>{t('agency:agreement.currentLead', { date: format.date(current.publishedAt), agreed: current.agreed, total: current.onBooks })}</p>
            </div>
            {!draft && <PdfButton label={t('agency:agreement.newVersion')} onFile={handleFile} busy={uploading} />}
          </div>
          <div className={styles.fileRow}>
            <FileLink file={current.file} />
          </div>
          <RulesList rules={current.rules} />
        </Panel>
      )}

      {earlier.length > 0 && (
        <Panel className={styles.card}>
          <h2 className={styles.title}>{t('agency:agreement.earlier')}</h2>
          <ul className={styles.earlier}>
            {earlier.map((version) => (
              <li key={version.version} className={styles.earlierRow}>
                <span className={styles.version}>{t('agency:agreement.version', { version: version.version })}</span>
                <span className={styles.date}>{format.date(version.publishedAt)}</span>
                <FileLink file={version.file} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t('agency:agreement.deleteTitle')}
        description={t('agency:agreement.deleteText')}
        confirmLabel={t('agency:agreement.deleteDraft')}
        tone="danger"
        onConfirm={async () => {
          await deleteDraft().unwrap().catch((error) => setProblem(errorText.code(error)))
          setConfirmDelete(false)
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}
