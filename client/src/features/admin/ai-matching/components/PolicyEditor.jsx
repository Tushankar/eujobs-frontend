import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Panel, Switch, TextareaField, TextField } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { serverFieldErrors, useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useActivatePolicyMutation, useArchivePolicyMutation, useSavePolicySignalsMutation, useUpdatePolicyMutation } from '../api.js'
import { checkLength, policyErrorText } from './policyErrors.js'
import styles from './PolicyEditor.module.css'

const SIGNALS = ['skills', 'experience', 'location']
const STATUS_TONES = { active: 'success', draft: 'neutral', archived: 'warning' }

/** Name and description of a policy, edited in place (M-049). */
function DetailsForm({ policy, onDone }) {
  const { t } = useTranslation('aiMatching')
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [update, { isLoading }] = useUpdatePolicyMutation()
  const form = useFormState({ name: policy.name, description: policy.description })
  const limits = config?.limits.matching

  async function handleSubmit(event) {
    event.preventDefault()
    const done = await form.run({ name: checkLength(form.values.name, limits.policyName), description: checkLength(form.values.description, limits.policyDescription) }, () =>
      update({ id: policy.id, name: form.values.name.trim(), description: form.values.description.trim() }).unwrap(),
    )
    if (done) onDone(t('editor.detailsSaved'))
  }

  return (
    <form className={styles.details} onSubmit={handleSubmit} noValidate>
      <TextField label={t('create.name')} value={form.values.name} onChange={(event) => form.set('name', event.target.value)} error={policyErrorText(t, 'name', form.errors.name)} />
      <TextareaField
        label={t('create.description')}
        value={form.values.description}
        onChange={(event) => form.set('description', event.target.value)}
        error={policyErrorText(t, 'description', form.errors.description)}
        rows={3}
      />
      {form.failure && <p className={styles.error}>{errorText.code(form.failure)}</p>}
      <div className={styles.actions}>
        <Button type="submit" disabled={isLoading || !limits}>
          {t('editor.saveDetails')}
        </Button>
        <Button variant="outline" onClick={() => onDone('')}>
          {t('editor.cancel')}
        </Button>
      </div>
    </form>
  )
}

/**
 * One matching policy (M-048, M-049): its signals, saved as a new version (skills or experience must stay on, P9-Q4),
 * activation, archiving a draft and the version history. The parent keys it by policy id.
 */
export default function PolicyEditor({ policy }) {
  const { t } = useTranslation('aiMatching')
  const format = useFormat()
  const errorText = useErrorText()
  const [signals, setSignals] = useState(policy.signals)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saveSignals, saving] = useSavePolicySignalsMutation()
  const [activate, activating] = useActivatePolicyMutation()
  const [archive, archiving] = useArchivePolicyMutation()
  const archived = policy.status === 'archived'
  const busy = saving.isLoading || activating.isLoading || archiving.isLoading

  async function attempt(work, success) {
    setMessage('')
    setError('')
    try {
      setMessage(success(await work().unwrap()))
    } catch (failed) {
      const fields = serverFieldErrors(failed)
      setError(fields.signals ? policyErrorText(t, 'signals', fields.signals) : errorText.code(failed))
    }
  }

  const handleSave = () =>
    attempt(
      () => saveSignals({ id: policy.id, signals }),
      (saved) => t(saved.status === 'active' ? 'editor.savedActive' : 'editor.saved', { version: saved.version }),
    )

  return (
    <Panel padding={28} data-policy={policy.id}>
      <SectionTitle title={policy.name} description={policy.description}>
        <PillBadge tone={STATUS_TONES[policy.status]} dot>
          {t(`enums:policyStatus.${policy.status}`)}
        </PillBadge>
      </SectionTitle>

      {editing ? (
        <DetailsForm
          policy={policy}
          onDone={(text) => {
            setEditing(false)
            setMessage(text)
          }}
        />
      ) : (
        !archived && (
          <Button variant="ghost" className={styles.editLink} onClick={() => setEditing(true)}>
            {t('editor.edit')}
          </Button>
        )
      )}

      <div className={styles.signals}>
        {SIGNALS.map((signal) => (
          <div className={styles.row} key={signal}>
            <div className={styles.copy}>
              <p className={styles.label}>{t(`signals.${signal}.label`)}</p>
              <p className={styles.description}>{t(`signals.${signal}.description`)}</p>
            </div>
            <Switch
              size="lg"
              label={t(`signals.${signal}.label`)}
              checked={signals[signal]}
              disabled={archived}
              onChange={(checked) => setSignals((current) => ({ ...current, [signal]: checked }))}
            />
          </div>
        ))}
        <div className={styles.row}>
          <div className={styles.copy}>
            <p className={styles.label}>{t('signals.humanReview.label')}</p>
            <p className={styles.description}>{t('signals.humanReview.description')}</p>
          </div>
          <Switch size="lg" label={t('signals.humanReview.label')} checked disabled onChange={() => {}} />
        </div>
      </div>

      {archived ? (
        <p className={styles.note}>{t('editor.archivedNote')}</p>
      ) : (
        <>
          <div className={styles.actions}>
            <Button onClick={handleSave} disabled={busy}>
              {t('editor.save')}
            </Button>
            {policy.status === 'draft' && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => attempt(() => activate(policy.id), (saved) => t('editor.activated', { name: saved.name }))}>
                  {t('editor.activate')}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => attempt(() => archive(policy.id), (saved) => t('editor.archived', { name: saved.name }))}>
                  {t('editor.archive')}
                </Button>
              </>
            )}
          </div>
          <p className={styles.note}>{t('editor.note')}</p>
        </>
      )}
      <p className={styles.message} role="status">
        {message}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <h3 className={styles.historyTitle}>{t('editor.history')}</h3>
      <ul className={styles.history}>
        {policy.versions.map((version) => (
          <li key={version.version}>
            <span className={styles.historyItem}>{t('editor.historyItem', { version: version.version, date: format.dateTime(version.createdAt) })}</span>
            <span className={styles.historySignals}>
              {t('editor.signalsOn', { signals: format.list(SIGNALS.filter((signal) => version.signals[signal]).map((signal) => t(`enums:policySignal.${signal}`))) })}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
