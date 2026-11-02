import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, TextareaField } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetCandidateNoteQuery, useSaveCandidateNoteMutation } from '../api.js'
import ProfileSection from '../components/ProfileSection.jsx'
import styles from './CandidateNotesPage.module.css'

/** Notes tab (M-080): one private note per company and candidate, up to 5,000 characters, with who changed it last. */
export default function CandidateNotesPage() {
  const { candidate } = useOutletContext()
  const { data: note } = useGetCandidateNoteQuery(candidate.id)
  return note ? <NoteForm candidate={candidate} note={note} /> : null
}

function NoteForm({ candidate, note }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [saveNote, { isLoading }] = useSaveCandidateNoteMutation()
  const [draft, setDraft] = useState(note.text)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const max = config?.limits.note.max

  async function handleSubmit(event) {
    event.preventDefault()
    if (draft.trim().length > max) return setError({ key: 'too_long', params: { max } })
    try {
      await saveNote({ id: candidate.id, text: draft }).unwrap()
      setSaved(true)
    } catch (failure) {
      setError(serverFieldErrors(failure).text ?? { key: 'invalid' })
    }
  }

  return (
    <ProfileSection labelledBy="notes-title">
      <SectionTitle id="notes-title" title={t('discovery:notesTab.title')} description={t('discovery:notesTab.description')} />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextareaField
          aria-label={t('discovery:notesTab.label', { name: candidate.fullName })}
          name="note"
          rows={7}
          placeholder={t('discovery:notesTab.placeholder')}
          hint={t('discovery:notesTab.hint', { max })}
          value={draft}
          error={errorText.field('text', error)}
          onChange={(event) => {
            setDraft(event.target.value)
            setSaved(false)
            setError(null)
          }}
        />
        <div className={styles.footer}>
          <Button type="submit" loading={isLoading}>
            {t('discovery:notesTab.save')}
          </Button>
          <p className={styles.status} role="status">
            {saved ? t('discovery:notesTab.saved') : ''}
            {note.updatedAt && ` ${t('discovery:notesTab.updated', { name: note.updatedBy ?? '', date: format.dateTime(note.updatedAt) })}`}
          </p>
        </div>
      </form>
    </ProfileSection>
  )
}
