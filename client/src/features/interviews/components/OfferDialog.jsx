import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Checkbox, Icon, IconButton, Modal, SelectField, TextField } from '@/components/ui'
import { useGetCompanyQuery } from '@/features/recruiter/company/api.js'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { toInstant, useOfferInterviewMutation, useRescheduleInterviewMutation } from '../api.js'
import styles from './Dialogs.module.css'

const FORM_ID = 'interview-offer-form'
const pad = (value) => String(value).padStart(2, '0')
const localDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** A first suggestion: the next working days at 10:00, in the viewer's time zone. */
function suggestedSlots(count) {
  const slots = []
  const day = new Date()
  while (slots.length < count) {
    day.setDate(day.getDate() + 1)
    if (day.getDay() !== 0 && day.getDay() !== 6) slots.push({ date: localDate(day), time: '10:00', minutes: '45' })
  }
  return slots
}

/**
 * Offer 2–3 interview slots (P11d-Q1, Q3, Q17, Q28): the application (when the candidate has several active ones with
 * the company), the mode with its address or link, each slot's date, time and length in the recruiter's time zone,
 * and AI notes for video. `interview` reopens a booked or offered interview with new slots (reschedule, P11d-Q15).
 */
export default function OfferDialog({ applications = [], applicationId, interview, onClose, onDone }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const { data: company } = useGetCompanyQuery()
  const limits = config?.limits.interviews
  const minutes = config?.limits.interviews.minutes ?? []
  const [offer] = useOfferInterviewMutation()
  const [reschedule] = useRescheduleInterviewMutation()
  const { values, set, errors, failure, run } = useFormState({
    applicationId: applicationId ?? applications[0]?.id ?? '',
    mode: interview?.mode ?? 'video',
    address: interview?.address ?? '',
    link: interview?.link ?? '',
    aiNotes: interview?.aiNotes ?? false,
  })
  const [slots, setSlots] = useState(() => suggestedSlots(3))
  const [today] = useState(() => localDate(new Date()))
  const [busy, setBusy] = useState(false)
  // P11d-Q28: the address starts as the company's business address.
  const address = values.address || (values.mode === 'in_person' ? (company?.businessAddress ?? '') : '')
  const setSlot = (index, field, value) => setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    const body = {
      mode: values.mode,
      ...(values.mode === 'in_person' && { address: address.trim() }),
      ...(values.mode === 'link' && { link: values.link.trim() }),
      aiNotes: values.mode === 'video' && values.aiNotes,
      slots: slots.map((slot) => ({ startAt: toInstant(slot.date, slot.time), minutes: Number(slot.minutes) })),
    }
    const ok = await run(
      {
        address: values.mode === 'in_person' && !address.trim() ? { key: 'required' } : undefined,
        link: values.mode === 'link' && !/^https:\/\/\S+$/.test(values.link.trim()) ? { key: 'invalid' } : undefined,
      },
      () => (interview ? reschedule({ id: interview.id, ...body }).unwrap() : offer({ applicationId: values.applicationId, ...body }).unwrap()),
    )
    setBusy(false)
    if (ok) (onDone ?? onClose)()
  }

  const slotError = (index) => {
    const error = errors[`slots.${index}`] ?? errors[`slots.${index}.startAt`] ?? errors[`slots.${index}.minutes`]
    return error && t(`interviews:offer.slotErrors.${error.key}`, { defaultValue: errorText.field('slots', error) })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t(interview ? 'interviews:offer.rescheduleTitle' : 'interviews:offer.title')}
      description={t('interviews:offer.description')}
      width={600}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy} data-offer-submit>
            {t(interview ? 'interviews:offer.sendNew' : 'interviews:offer.send')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className={styles.form} onSubmit={submit} noValidate>
        {!interview && applications.length > 1 && (
          <SelectField
            label={t('interviews:offer.application')}
            value={values.applicationId}
            onChange={(event) => set('applicationId', event.target.value)}
            options={applications.map((application) => ({ value: application.id, label: application.job.title }))}
          />
        )}
        <SelectField
          label={t('interviews:offer.mode')}
          value={values.mode}
          onChange={(event) => set('mode', event.target.value)}
          options={(config?.enums.interviewMode ?? ['video']).map((mode) => ({ value: mode, label: t(`enums:interviewMode.${mode}`) }))}
          data-offer-mode
        />
        {values.mode === 'in_person' && (
          <TextField label={t('interviews:offer.address')} value={address} maxLength={limits?.address.max} onChange={(event) => set('address', event.target.value)} error={errorText.field('address', errors.address)} />
        )}
        {values.mode === 'link' && (
          <TextField
            label={t('interviews:offer.link')}
            type="url"
            placeholder="https://"
            value={values.link}
            maxLength={limits?.link.max}
            onChange={(event) => set('link', event.target.value)}
            error={errors.link && t('interviews:offer.linkInvalid')}
          />
        )}
        {values.mode === 'phone' && <p className={styles.hint}>{t('interviews:offer.phoneHint')}</p>}

        <fieldset className={styles.slots}>
          <legend className={styles.legend}>{t('interviews:offer.slots')}</legend>
          <p className={styles.hint}>{t('interviews:offer.slotsHint')}</p>
          {slots.map((slot, index) => (
            <div key={index} className={styles.slotRow} data-slot-row={index}>
              <TextField label={t('interviews:offer.date')} type="date" value={slot.date} min={today} onChange={(event) => setSlot(index, 'date', event.target.value)} error={slotError(index)} />
              <TextField label={t('interviews:offer.time')} type="time" step={300} value={slot.time} onChange={(event) => setSlot(index, 'time', event.target.value)} />
              <SelectField
                label={t('interviews:offer.length')}
                value={slot.minutes}
                onChange={(event) => setSlot(index, 'minutes', event.target.value)}
                options={minutes.map((value) => ({ value: String(value), label: t('interviews:minutes', { count: value }) }))}
              />
              {slots.length > (limits?.slots.min ?? 2) && (
                <IconButton icon={X} label={t('interviews:offer.removeSlot')} className={styles.removeSlot} onClick={() => setSlots((current) => current.filter((_, i) => i !== index))} />
              )}
            </div>
          ))}
          {slots.length < (limits?.slots.max ?? 3) && (
            <Button variant="ghost" leftIcon={<Icon as={Plus} size={14} />} onClick={() => setSlots((current) => [...current, suggestedSlots(current.length + 1).at(-1)])}>
              {t('interviews:offer.addSlot')}
            </Button>
          )}
        </fieldset>

        {values.mode === 'video' && (
          <Checkbox checked={values.aiNotes} onChange={(event) => set('aiNotes', event.target.checked)} data-ai-notes>
            <span className={styles.checkText}>
              <strong>{t('interviews:offer.aiNotes')}</strong>
              <span>{t('interviews:offer.aiNotesHint')}</span>
            </span>
          </Checkbox>
        )}
        {failure && <p className={styles.error}>{errorText.code(failure)}</p>}
      </form>
    </Modal>
  )
}
