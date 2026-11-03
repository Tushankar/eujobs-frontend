import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import aiSparkle from '@/assets/icons/ai-sparkle-blue-16.svg'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Icon, Modal, TextareaField, TextField } from '@/components/ui'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useCreatePolicyMutation, useSuggestPolicyDescriptionMutation } from '../api.js'
import { checkLength, policyErrorText } from './policyErrors.js'
import styles from './CreatePolicyModal.module.css'

/**
 * "Create matching policy" (A: admin §1.19): a named draft with every signal on; human review stays required.
 * "Improve description" asks OpenAI (OPENAI_MODEL, M-048) for a description in the admin's language.
 */
export default function CreatePolicyModal({ onClose, onCreated }) {
  const { t } = useTranslation('aiMatching')
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [create, { isLoading }] = useCreatePolicyMutation()
  const [suggest, suggesting] = useSuggestPolicyDescriptionMutation()
  const form = useFormState({ name: '', description: '' })
  const [suggested, setSuggested] = useState(false)
  const { values, errors } = form
  const limits = config?.limits.matching
  const hasText = values.name.trim() !== '' && values.description.trim() !== ''

  function update(field) {
    return (event) => {
      form.set(field, event.target.value)
      setSuggested(false)
    }
  }

  async function handleImprove() {
    suggesting.reset()
    try {
      const { description } = await suggest({ name: values.name.trim(), description: values.description.trim() }).unwrap()
      form.set('description', description)
      setSuggested(true)
    } catch {
      // The failure is shown under the button.
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    let created
    const done = await form.run({ name: checkLength(values.name, limits.policyName), description: checkLength(values.description, limits.policyDescription) }, async () => {
      created = await create({ name: values.name.trim(), description: values.description.trim() }).unwrap()
    })
    if (done) onCreated(created)
  }

  return (
    <Modal open onClose={onClose} title={t('create.title')} width={512} divided>
      <form onSubmit={handleSubmit} noValidate>
        <p className={styles.intro}>{t('create.intro')}</p>

        <TextField
          className={styles.field}
          label={t('create.name')}
          placeholder={t('create.namePlaceholder')}
          value={values.name}
          onChange={update('name')}
          error={policyErrorText(t, 'name', errors.name)}
          autoComplete="off"
          data-autofocus
        />
        <TextareaField
          className={styles.descriptionField}
          label={t('create.description')}
          placeholder={t('create.descriptionPlaceholder')}
          hint={t('create.descriptionHint')}
          value={values.description}
          onChange={update('description')}
          error={policyErrorText(t, 'description', errors.description)}
          rows={4}
        />

        <div className={styles.assist}>
          <span className={styles.assistIcon}>
            <img src={aiSparkle} alt="" width={16} height={16} />
          </span>
          <div className={styles.assistBody}>
            <p className={styles.assistTitle}>{t('create.assistTitle')}</p>
            <p className={styles.assistText} role="status">
              {suggesting.isLoading ? t('create.improving') : suggested ? t('create.assistDone') : t('create.assistIdle')}
            </p>
            <Button
              variant="outline"
              className={styles.improve}
              disabled={!hasText || suggesting.isLoading}
              onClick={handleImprove}
              leftIcon={<Icon as={Sparkles} size={13} />}
            >
              {t('create.improve')}
            </Button>
            {suggesting.isError && (
              <p className={styles.assistError} role="alert">
                {errorText.code(suggesting.error)}
              </p>
            )}
            <p className={styles.assistNote}>{t('create.assistNote')}</p>
          </div>
        </div>

        {form.failure && (
          <p className={styles.assistError} role="alert">
            {errorText.code(form.failure)}
          </p>
        )}
        <div className={styles.footer}>
          <Button variant="outline" onClick={onClose}>
            {t('create.cancel')}
          </Button>
          <Button type="submit" className={styles.create} disabled={!hasText || isLoading || !limits}>
            {t('create.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
