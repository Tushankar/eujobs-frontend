import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Checkbox, Modal, Skeleton, TextareaField } from '@/components/ui'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useRejectApplicationMutation } from '@/features/recruiter/applications/api.js'
import { useGetInterviewNotesQuery, useRecordOutcomeMutation } from '../api.js'
import styles from './Dialogs.module.css'

/**
 * A short required note sent with an action: "Ask for other times", "Ask to reschedule", a decline (P11d-Q3, Q14, Q20)
 * or an optional one (a cancellation reason). `send(note)` returns the mutation promise.
 */
export function NoteDialog({ title, description, label, submitLabel, max, required = true, tone, send, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { values, set, errors, failure, run } = useFormState({ note: '' })
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    const note = values.note.trim()
    const ok = await run({ note: required && !note ? { key: 'required' } : note.length > max ? { key: 'too_long', params: { max } } : undefined }, () => send(note))
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form="interview-note-form" variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} data-note-submit>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="interview-note-form" className={styles.form} onSubmit={submit} noValidate>
        <TextareaField label={label} rows={4} value={values.note} maxLength={max} onChange={(event) => set('note', event.target.value)} error={errorText.field('note', errors.note)} autoFocus data-note-field />
        {failure && <p className={styles.error}>{errorText.code(failure)}</p>}
      </form>
    </Modal>
  )
}

/**
 * The outcome and a private feedback note (P11d-Q6, Q11, Q12): Offer, Another round, Not selected (with the reject
 * flow's "Email the candidate" box, M-090) or Didn't attend. `onNext(result)` opens what follows (new slots).
 */
export function OutcomeDialog({ interview, candidateName, onClose, onNext }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [record] = useRecordOutcomeMutation()
  const { values, set, failure, run } = useFormState({ result: 'offer', note: '', notify: true })
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    const ok = await run({}, () =>
      record({ id: interview.id, result: values.result, note: values.note.trim() || undefined, ...(values.result === 'not_selected' && { notify: values.notify }) }).unwrap(),
    )
    setBusy(false)
    if (ok) onNext(values.result)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t('interviews:outcome.title')}
      description={t('interviews:outcome.description', { name: candidateName })}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form="interview-outcome-form" loading={busy} data-outcome-submit>
            {t('interviews:outcome.save')}
          </Button>
        </>
      }
    >
      <form id="interview-outcome-form" className={styles.form} onSubmit={submit} noValidate>
        <fieldset className={styles.outcomes}>
          {(config?.enums.interviewOutcome ?? []).map((result) => (
            <label key={result} className={styles.outcome}>
              <input type="radio" name="outcome" value={result} checked={values.result === result} onChange={() => set('result', result)} data-outcome={result} />
              {t(`enums:interviewOutcome.${result}`)}
            </label>
          ))}
        </fieldset>
        {values.result === 'not_selected' && (
          <Checkbox checked={values.notify} onChange={(event) => set('notify', event.target.checked)}>
            {t('interviews:outcome.notify')}
          </Checkbox>
        )}
        <TextareaField
          label={t('interviews:outcome.note')}
          hint={t('interviews:outcome.noteHint')}
          rows={4}
          maxLength={config?.limits.interviews.feedback.max}
          value={values.note}
          onChange={(event) => set('note', event.target.value)}
        />
        {failure && <p className={styles.error}>{errorText.code(failure)}</p>}
      </form>
    </Modal>
  )
}

/** P11d-Q11: after "Didn't attend", offer new times or close the application as Not selected (the reject flow, M-090). */
export function NoShowDialog({ interview, candidateName, onReschedule, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [reject, { isLoading, error }] = useRejectApplicationMutation()
  const [notify, setNotify] = useState(true)
  return (
    <Modal
      open
      onClose={onClose}
      title={t('interviews:noShow.title')}
      description={t('interviews:noShow.description', { name: candidateName })}
      width={480}
      footer={
        <>
          <Button variant="danger" loading={isLoading} onClick={() => reject({ id: interview.applicationId, notify }).unwrap().then(onClose)} data-no-show-reject>
            {t('interviews:noShow.notSelected')}
          </Button>
          <Button onClick={onReschedule} data-no-show-reschedule>
            {t('interviews:noShow.reschedule')}
          </Button>
        </>
      }
    >
      <Checkbox checked={notify} onChange={(event) => setNotify(event.target.checked)}>
        {t('interviews:outcome.notify')}
      </Checkbox>
      {error && <p className={styles.error}>{errorText.code(error)}</p>}
    </Modal>
  )
}

/** The company's AI interview notes and transcript (P11d-Q5). */
export function NotesDialog({ interview, candidateName, onClose }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { data, isLoading } = useGetInterviewNotesQuery(interview.id)
  const lists = ['keyAnswers', 'strengths', 'concerns', 'followUps']
  return (
    <Modal open onClose={onClose} title={t('interviews:notes.title')} description={t('interviews:notes.description', { name: candidateName })} width={640}>
      {isLoading || !data ? (
        <Skeleton shape="block" height={200} />
      ) : (
        <div className={styles.form} data-interview-notes>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('interviews:notes.summary')}</h3>
            <p className={styles.paragraph} data-notes-summary>
              {data.summary}
            </p>
          </section>
          {lists.map(
            (key) =>
              data[key].length > 0 && (
                <section key={key} className={styles.section}>
                  <h3 className={styles.sectionTitle}>{t(`interviews:notes.${key}`)}</h3>
                  <ul className={styles.list} data-notes-list={key}>
                    {data[key].map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </section>
              ),
          )}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('interviews:notes.transcript')}</h3>
            <div className={styles.transcript} tabIndex={0} data-notes-transcript>
              {data.transcript}
            </div>
          </section>
          <p className={styles.hint}>{t('interviews:notes.generated', { date: format.dateTime(data.generatedAt) })}</p>
        </div>
      )}
    </Modal>
  )
}
