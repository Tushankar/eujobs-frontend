import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, TextareaField } from '@/components/ui'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import styles from './MessageForm.module.css'

/**
 * A message body (M-086: text only, up to the server's limit) with the character count. `onSubmit(body)` returns a
 * promise; a failure maps the server's field errors. Used by the thread composer and the start dialog (`formId`).
 */
export default function MessageForm({ initialBody = '', submitLabel, onSubmit, resetOnSuccess = false, formId, rows = 3, autoFocus = false }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const max = config?.limits.message.body.max
  const { values, set, errors, failure, run } = useFormState({ body: initialBody })
  const generatedId = useId()
  const id = formId ?? generatedId

  async function handleSubmit(event) {
    event.preventDefault()
    const body = values.body.trim()
    const sent = await run({ body: check.text(body, max ?? Infinity) }, () => onSubmit(body))
    if (sent && resetOnSuccess) set('body', '')
  }

  return (
    <form id={id} className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextareaField
        label={t('messages:form.label')}
        name="body"
        rows={rows}
        data-autofocus={autoFocus || undefined}
        value={values.body}
        hint={max ? t('messages:form.count', { count: values.body.length, max }) : undefined}
        error={errorText.field('body', errors.body)}
        onChange={(event) => set('body', event.target.value)}
      />
      {failure && (
        <p className={styles.failure} role="alert">
          {errorText.code(failure)}
        </p>
      )}
      {!formId && (
        <div className={styles.actions}>
          <Button type="submit">{submitLabel}</Button>
        </div>
      )}
    </form>
  )
}
