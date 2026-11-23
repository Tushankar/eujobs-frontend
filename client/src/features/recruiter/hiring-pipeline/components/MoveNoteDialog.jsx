import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { hiringPath } from '@/app/roles.js'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon, Modal, Skeleton, SkeletonRegion, TextareaField } from '@/components/ui'
import { useAddCandidateNoteMutation, useGetCandidateNotesQuery } from '@/features/recruiter/find-candidates/api.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './MoveNoteDialog.module.css'

const SHOWN = 3

/**
 * 2026-11-23 (owner: "before moving, show notes"): every stage move asks here first. The candidate's latest notes, an
 * optional note saved with this application, then Move. `onMove()` runs the move itself and may throw (a refused
 * Hired, say), which shows here; a note already saved is not saved again on retry.
 */
export default function MoveNoteDialog({ candidateId, candidateName, jobTitle, fromName, toName, applicationId, onMove, onClose }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { data, isLoading } = useGetCandidateNotesQuery(candidateId, { skip: !candidateId })
  const [addNote] = useAddCandidateNoteMutation()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const notes = data?.items ?? []
  const max = config?.limits.note.max

  async function move() {
    setBusy(true)
    setFailure(null)
    try {
      if (text.trim() && !saved && candidateId) {
        await addNote({ id: candidateId, text: text.trim(), applicationId }).unwrap()
        setSaved(true)
      }
      await onMove()
    } catch (error) {
      setFailure(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('applications:moveNote.title', { name: candidateName ?? '', stage: toName })}
      description={jobTitle ?? undefined}
      width={520}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t('common:cancel')}
          </Button>
          <Button loading={busy} onClick={move} data-move-confirm>
            {t('applications:moveNote.move')}
          </Button>
        </>
      }
    >
      <div className={styles.body} data-move-note>
        <p className={styles.stages}>
          <PillBadge tone="neutral">{fromName}</PillBadge>
          <Icon as={ArrowRight} size={14} />
          <PillBadge tone="info">{toName}</PillBadge>
        </p>

        <section className={styles.notes} aria-labelledby="move-notes-title">
          <div className={styles.notesHead}>
            <h3 id="move-notes-title" className={styles.notesTitle}>
              {t('applications:moveNote.notes', { total: notes.length })}
            </h3>
            {candidateId && notes.length > SHOWN && (
              <Link to={hiringPath(`find-candidates/${candidateId}/notes`)} className={styles.all} onClick={onClose}>
                {t('applications:moveNote.all')}
              </Link>
            )}
          </div>
          {isLoading ? (
            <SkeletonRegion className={styles.list}>
              <Skeleton width="90%" height={12} />
              <Skeleton width="70%" height={12} />
            </SkeletonRegion>
          ) : notes.length === 0 ? (
            <p className={styles.none}>{t('applications:moveNote.none')}</p>
          ) : (
            <ul className={styles.list}>
              {notes.slice(0, SHOWN).map((note) => (
                <li key={note.id} className={styles.note} data-move-note-item>
                  <span className={styles.noteMeta}>
                    {format.date(note.createdAt)} · {note.author?.name ?? t('discovery:notes.formerMember')}
                  </span>
                  <span className={styles.noteText}>{note.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <TextareaField
          label={t('applications:moveNote.add')}
          hint={saved ? t('applications:moveNote.saved') : t('applications:moveNote.hint')}
          name="moveNote"
          rows={3}
          maxLength={max}
          value={text}
          disabled={saved}
          onChange={(event) => setText(event.target.value)}
        />
        {failure && (
          <p className={styles.failure} role="alert">
            {errorText.code(failure)}
          </p>
        )}
      </div>
    </Modal>
  )
}
