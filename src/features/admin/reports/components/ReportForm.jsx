import { useRef, useState } from 'react'
import { Download, Upload, X } from 'lucide-react'
import { Button, Icon, IconButton, Panel, SelectField, TextareaField } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { MAX_BRIEF_LENGTH, REPORT_TYPES } from '../data/reports.js'
import styles from './ReportForm.module.css'

/** "Create a report": choose a type, add context and an optional voice-note file name, then generate a CSV. */
export default function ReportForm({ onGenerate }) {
  const fileInput = useRef(null)
  const [typeId, setTypeId] = useState(REPORT_TYPES[0].id)
  const [brief, setBrief] = useState('')
  const [voiceNote, setVoiceNote] = useState('')
  const [errors, setErrors] = useState({})

  function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      setErrors((current) => ({ ...current, voiceNote: 'Choose an audio file, for example .mp3, .m4a or .wav.' }))
      return
    }
    setVoiceNote(file.name)
    setErrors((current) => ({ ...current, voiceNote: undefined }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (brief.length > MAX_BRIEF_LENGTH) {
      setErrors((current) => ({ ...current, brief: `Keep the brief to ${MAX_BRIEF_LENGTH} characters or fewer.` }))
      return
    }
    setErrors({})
    onGenerate({ typeId, brief: brief.trim(), voiceNote })
  }

  return (
    <Panel padding={28}>
      <form onSubmit={handleSubmit} noValidate>
        <SectionTitle title="Create a report" />

        <SelectField
          className={styles.field}
          label="Report type"
          value={typeId}
          onChange={(event) => setTypeId(event.target.value)}
          options={REPORT_TYPES.map((type) => ({ value: type.id, label: type.label }))}
        />

        <TextareaField
          className={styles.brief}
          label="Report brief"
          placeholder="For example, focus on hiring-stage movement and roles with low application coverage."
          hint="Add context, questions, or priorities to include with the export."
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
            Voice note
          </p>
          <div className={styles.drop}>
            <span className={styles.dropIcon}>
              <Icon as={Upload} size={18} />
            </span>
            <button
              type="button"
              className={styles.dropButton}
              aria-labelledby="voice-note-label voice-note-title"
              onClick={() => fileInput.current?.click()}
            >
              <span className={styles.dropTitle} id="voice-note-title">
                {voiceNote || 'Record or attach a voice note'}
              </span>
              <span className={styles.dropHint}>{voiceNote ? 'Audio file attached' : 'Audio files supported'}</span>
            </button>
            {voiceNote && (
              <IconButton icon={X} label="Remove voice note" onClick={() => setVoiceNote('')} />
            )}
            <input ref={fileInput} type="file" accept="audio/*" className={styles.fileInput} onChange={handleFile} tabIndex={-1} />
          </div>
          {errors.voiceNote ? (
            <p className={styles.error} role="alert">
              {errors.voiceNote}
            </p>
          ) : (
            <p className={styles.hint}>
              Optional audio context. This prototype records the file name in the CSV; it does not upload or transcribe
              audio.
            </p>
          )}
        </div>

        <p className={styles.scope}>
          CSV export · Current local workspace · Written context and the voice note file name are included · No resume
          contents, private notes, or audio files included.
        </p>

        <Button type="submit" leftIcon={<Icon as={Download} size={14} />}>
          Generate &amp; download
        </Button>
      </form>
    </Panel>
  )
}
