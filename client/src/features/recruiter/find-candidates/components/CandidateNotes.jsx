import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Avatar, Button, Dropdown, IconButton, TextareaField } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import { serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useAddCandidateNoteMutation, useDeleteCandidateNoteMutation, useEditCandidateNoteMutation, useGetCandidateNotesQuery } from '../api.js'
import styles from './CandidateNotes.module.css'

/** Client check before the server's: a note needs text and at most `max` characters. */
function checkText(text, max) {
  if (!text.trim()) return { key: 'required' }
  if (text.trim().length > max) return { key: 'too_long', params: { max } }
  return null
}

/** The date and time a note was written, its age, and when it was last edited. */
function NoteTime({ note }) {
  const { t } = useTranslation()
  const format = useFormat()
  return (
    <p className={styles.time}>
      <time dateTime={note.createdAt} title={format.dateTime(note.createdAt)}>
        {format.dateTime(note.createdAt)}
      </time>
      <span aria-hidden="true"> · </span>
      <span>{format.relative(note.createdAt)}</span>
      {note.editedAt && (
        <>
          <span aria-hidden="true"> · </span>
          <span title={format.dateTime(note.editedAt)}>{t('discovery:notes.edited', { date: format.dateTime(note.editedAt) })}</span>
        </>
      )}
    </p>
  )
}

function Note({ note, candidateId, max }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [editNote, { isLoading: saving }] = useEditCandidateNoteMutation()
  const [deleteNote] = useDeleteCandidateNoteMutation()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const author = note.author.name ?? t('discovery:notes.formerMember')

  async function save(event) {
    event.preventDefault()
    const problem = checkText(draft, max)
    if (problem) return setError(problem)
    try {
      await editNote({ id: candidateId, noteId: note.id, text: draft }).unwrap()
      setDraft(null)
    } catch (failure) {
      setError(serverFieldErrors(failure).text ?? { key: 'invalid' })
    }
  }

  return (
    <li className={styles.note} data-note={note.id}>
      <Avatar name={author} size={32} />
      <div className={styles.body}>
        <div className={styles.head}>
          <div className={styles.who}>
            <p className={styles.author}>{author}</p>
            <NoteTime note={note} />
          </div>
          {note.mine && draft === null && (
            <Dropdown panelClassName={styles.menuPanel} trigger={(props) => <IconButton icon={MoreHorizontal} label={t('discovery:notes.actions')} iconSize={16} {...props} />}>
              {({ close }) => (
                <ul className={styles.menu}>
                  <li>
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => {
                        close()
                        setDraft(note.text)
                        setError(null)
                      }}
                    >
                      {t('discovery:notes.edit')}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`${styles.menuItem} ${styles.danger}`}
                      onClick={() => {
                        close()
                        setDeleting(true)
                      }}
                    >
                      {t('discovery:notes.delete')}
                    </button>
                  </li>
                </ul>
              )}
            </Dropdown>
          )}
        </div>
        {note.context && <p className={styles.context}>{[note.context.stageName, note.context.jobTitle].filter(Boolean).join(' · ')}</p>}
        {draft === null ? (
          <p className={styles.text}>{note.text}</p>
        ) : (
          <form className={styles.editForm} onSubmit={save} noValidate>
            <TextareaField
              aria-label={t('discovery:notes.editLabel')}
              name="noteEdit"
              rows={3}
              value={draft}
              error={errorText.field('text', error)}
              onChange={(event) => {
                setDraft(event.target.value)
                setError(null)
              }}
            />
            <div className={styles.actions}>
              <Button type="button" variant="outline" size="sm" onClick={() => setDraft(null)}>
                {t('discovery:notes.cancel')}
              </Button>
              <Button type="submit" size="sm" loading={saving}>
                {t('discovery:notes.save')}
              </Button>
            </div>
          </form>
        )}
      </div>
      <ConfirmDialog
        open={deleting}
        title={t('discovery:notes.deleteTitle')}
        description={t('discovery:notes.deleteText')}
        confirmLabel={t('discovery:notes.delete')}
        tone="danger"
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false)
          deleteNote({ id: candidateId, noteId: note.id })
        }}
      />
    </li>
  )
}

/**
 * M-080 (owner decision 2026-11-05): the company's dated notes on a candidate, newest first, with a composer. Everyone
 * in the company reads them; only the author edits or deletes one. Used on the profile's Notes tab and in the Hiring
 * pipeline's candidate panel, where `applicationId` stores the stage and job with the note.
 */
export default function CandidateNotes({ candidateId, candidateName, applicationId }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { data } = useGetCandidateNotesQuery(candidateId)
  const [addNote, { isLoading }] = useAddCandidateNoteMutation()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const max = config?.limits.note.max ?? 0
  const notes = data?.items ?? []

  async function add(event) {
    event.preventDefault()
    const problem = checkText(draft, max)
    if (problem) return setError(problem)
    try {
      await addNote({ id: candidateId, text: draft, ...(applicationId && { applicationId }) }).unwrap()
      setDraft('')
    } catch (failure) {
      setError(serverFieldErrors(failure).text ?? { key: 'invalid' })
    }
  }

  return (
    <div className={styles.root} data-notes={candidateId}>
      <form className={styles.composer} onSubmit={add} noValidate>
        <TextareaField
          aria-label={t('discovery:notes.label', { name: candidateName })}
          name="note"
          rows={3}
          placeholder={t('discovery:notes.placeholder')}
          hint={t('discovery:notes.hint', { max })}
          value={draft}
          error={errorText.field('text', error)}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
        />
        <div className={styles.actions}>
          <Button type="submit" size="sm" loading={isLoading} disabled={!draft.trim()}>
            {t('discovery:notes.add')}
          </Button>
        </div>
      </form>

      <p className={styles.count}>{t('discovery:notes.count', { count: notes.length })}</p>
      {data && notes.length === 0 && <p className={styles.empty}>{t('discovery:notes.empty')}</p>}
      <ul className={styles.list}>
        {notes.map((note) => (
          <Note key={note.id} note={note} candidateId={candidateId} max={max} />
        ))}
      </ul>
    </div>
  )
}
