import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button, TextareaField } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import ProfileSection from '../components/ProfileSection.jsx'
import { useCandidateNotes } from '../hooks/useCandidateNotes.js'
import styles from './CandidateNotesPage.module.css'

export default function CandidateNotesPage() {
  const { candidate } = useOutletContext()
  const { getNote, saveNote } = useCandidateNotes()
  const [draft, setDraft] = useState(() => getNote(candidate.id))
  const [saved, setSaved] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    saveNote(candidate.id, draft)
    setSaved(true)
  }

  return (
    <ProfileSection labelledBy="notes-title">
      <SectionTitle
        id="notes-title"
        title="Your private review notes"
        description="Focus on relevant evidence. Avoid recording sensitive personal information."
      />
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextareaField
          aria-label={`Private notes about ${candidate.name}`}
          rows={7}
          placeholder="What stands out? What needs a closer look?"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setSaved(false)
          }}
        />
        <div className={styles.footer}>
          <Button type="submit">Save notes</Button>
          <p className={styles.status} role="status">
            {saved ? 'Notes saved on this device.' : ''}
          </p>
        </div>
      </form>
    </ProfileSection>
  )
}
