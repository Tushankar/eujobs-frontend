import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { Checkbox, TextareaField, TextField } from '@/components/ui'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { useAddEntryMutation, useUpdateEntryMutation } from '../api.js'
import FormDialog from './FormDialog.jsx'
import dialogStyles from './FormDialog.module.css'

/*
 * One work-history role (M-018) or education entry (M-019): months as "YYYY-MM"; an end month unless the
 * entry is ongoing. `kind` is the API path: "work-history" or "education".
 */
const KINDS = {
  'work-history': { form: 'work', texts: ['title', 'employer'], ongoing: 'current', description: true },
  education: { form: 'education', texts: ['institution', 'degree'], ongoing: 'stillStudying', description: false },
}

export default function EntryDialog({ open, kind, entry, onSaved, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [addEntry, { isLoading: adding }] = useAddEntryMutation()
  const [updateEntry, { isLoading: updating }] = useUpdateEntryMutation()
  const { form, texts, ongoing, description } = KINDS[kind]
  const { values, set, errors, failure, run } = useFormState(() => ({
    ...Object.fromEntries(texts.map((name) => [name, entry?.[name] ?? ''])),
    start: entry?.start ?? '',
    end: entry?.end ?? '',
    ongoing: entry?.[ongoing] ?? false,
    description: entry?.description ?? '',
  }))
  const limits = config?.limits.profile
  const label = (name) => t(`profile:form.${form}.${name}`)

  async function handleSubmit() {
    const body = {
      ...Object.fromEntries(texts.map((name) => [name, values[name].trim()])),
      start: values.start,
      end: values.ongoing ? null : values.end || null,
      [ongoing]: values.ongoing,
      ...(description && { description: values.description.trim() }),
    }
    const checks = {
      ...Object.fromEntries(texts.map((name) => [name, check.text(values[name], limits.entryText.max)])),
      start: values.start ? undefined : { key: 'required' },
      end: body.end || values.ongoing ? (body.end && values.start && body.end < values.start ? { key: 'before_start' } : undefined) : { key: 'required' },
      description: description ? check.maxLength(values.description, limits.description.max) : undefined,
    }
    const work = () => (entry ? updateEntry({ kind, id: entry.id, body }) : addEntry({ kind, body })).unwrap()
    if (await run(checks, work)) onSaved()
  }

  if (!limits) return null
  const field = (name) => errorText.field(name, errors[name])

  return (
    <FormDialog open={open} title={label(entry ? 'editTitle' : 'addTitle')} busy={adding || updating} failure={failure} onClose={onClose} onSubmit={handleSubmit}>
      <div className={dialogStyles.row}>
        {texts.map((name, index) => (
          <TextField key={name} label={label(name)} name={name} value={values[name]} onChange={(event) => set(name, event.target.value)} error={field(name)} data-autofocus={index === 0 || undefined} />
        ))}
      </div>
      <div className={dialogStyles.row}>
        <TextField label={label('start')} name="start" type="month" value={values.start} onChange={(event) => set('start', event.target.value)} error={field('start')} />
        <TextField label={label('end')} name="end" type="month" disabled={values.ongoing} value={values.ongoing ? '' : values.end} onChange={(event) => set('end', event.target.value)} error={field('end')} />
      </div>
      <Checkbox name="ongoing" checked={values.ongoing} onChange={(event) => set('ongoing', event.target.checked)}>
        {label(ongoing)}
      </Checkbox>
      {description && (
        <TextareaField
          label={label('description')}
          name="description"
          rows={4}
          value={values.description}
          onChange={(event) => set('description', event.target.value)}
          error={field('description')}
          hint={t('profile:form.core.count', { count: values.description.trim().length, max: limits.description.max })}
        />
      )}
    </FormDialog>
  )
}
