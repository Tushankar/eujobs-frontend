import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Upload, X } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Icon, IconButton, Panel, SelectField, TextareaField } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { checkUpload, useUploadText } from '@/lib/forms.js'
import styles from './ReportForm.module.css'

const TYPES = ['marketplace_summary', 'skills_demand', 'platform_activity']
const PERIODS = ['this_week', 'last_week', 'last_month']

/**
 * "Create a report" (M-181 … M-183): the type, the period, a brief (≤ 500) and an optional voice note to attach
 * (mp3, m4a, wav, webm or ogg up to 25 MB). The server transcribes it, writes the summary and stores the CSV.
 */
export default function ReportForm({ busy, failure, onGenerate }) {
  const { t } = useTranslation(['adminReports', 'enums'])
  const { data: config } = useGetConfigQuery()
  const rule = config?.limits.uploads.report_voice
  const maxBrief = config?.limits.reportBrief.max
  const upload = useUploadText(rule)
  const fileInput = useRef(null)
  const [type, setType] = useState(TYPES[0])
  const [period, setPeriod] = useState(PERIODS[0])
  const [brief, setBrief] = useState('')
  const [voiceNote, setVoiceNote] = useState(null)
  const [errors, setErrors] = useState({})

  function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const problem = checkUpload(file, rule)
    if (problem) return setErrors((current) => ({ ...current, voiceNote: upload.problem(problem, file) }))
    setVoiceNote(file)
    setErrors((current) => ({ ...current, voiceNote: undefined }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (brief.trim().length > maxBrief) return setErrors((current) => ({ ...current, brief: t('form.briefTooLong', { max: maxBrief }) }))
    setErrors({})
    onGenerate({ type, period, brief: brief.trim(), voiceNote })
  }

  return (
    <Panel padding={28}>
      <form onSubmit={handleSubmit} noValidate data-report-create>
        <SectionTitle title={t('form.title')} />
        <SelectField
          className={styles.field}
          name="type"
          label={t('form.type')}
          value={type}
          onChange={(event) => setType(event.target.value)}
          options={TYPES.map((value) => ({ value, label: t(`types.${value}`) }))}
        />
        <SelectField
          className={styles.field}
          name="period"
          label={t('form.period')}
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          options={PERIODS.map((value) => ({ value, label: t(`enums:reportPeriod.${value}`) }))}
        />
        <TextareaField
          className={styles.brief}
          name="brief"
          label={t('form.brief')}
          placeholder={t('form.briefPlaceholder')}
          hint={t('form.briefHint', { count: brief.length, max: maxBrief })}
          value={brief}
          onChange={(event) => {
            setBrief(event.target.value)
            setErrors((current) => ({ ...current, brief: undefined }))
          }}
          error={errors.brief}
          rows={4}
        />
        <div className={styles.field}>
          <p className={styles.label} id="voice-note-label">
            {t('form.voiceNote')}
          </p>
          <div className={styles.drop}>
            <span className={styles.dropIcon}>
              <Icon as={Upload} size={18} />
            </span>
            <button type="button" className={styles.dropButton} aria-labelledby="voice-note-label voice-note-title" onClick={() => fileInput.current?.click()}>
              <span className={styles.dropTitle} id="voice-note-title">
                {voiceNote?.name ?? t('form.attach')}
              </span>
              <span className={styles.dropHint}>{voiceNote ? t('form.attached') : upload.limits}</span>
            </button>
            {voiceNote && <IconButton icon={X} label={t('form.removeVoiceNote')} onClick={() => setVoiceNote(null)} />}
            <input ref={fileInput} type="file" name="voiceNote" accept=".mp3,.m4a,.wav,.webm,.ogg,audio/*" className={styles.fileInput} onChange={handleFile} tabIndex={-1} />
          </div>
          {errors.voiceNote ? (
            <p className={styles.error} role="alert">
              {errors.voiceNote}
            </p>
          ) : (
            <p className={styles.hint}>{t('form.voiceHint')}</p>
          )}
        </div>
        <p className={styles.scope}>{t('form.scope')}</p>
        {failure && (
          <p className={styles.error} role="alert">
            {failure}
          </p>
        )}
        <Button type="submit" loading={busy} leftIcon={<Icon as={Download} size={14} />}>
          {t(busy ? 'form.generating' : 'form.submit')}
        </Button>
      </form>
    </Panel>
  )
}
