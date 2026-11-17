import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Undo2 } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Icon, TextField } from '@/components/ui'
import { useDraftCompanyDescriptionMutation } from '@/features/ai/api.js'
import AiButton from '@/features/ai/components/AiButton.jsx'
import AiStatus from '@/features/ai/components/AiStatus.jsx'
import styles from './CompanyAiDraft.module.css'

/**
 * The company description writer (owner 2026-11-17): AI writes "About the company" from the details in the form
 * (name, industry, size, city) and optional notes, never from the website. It replaces the text in the field, with
 * Undo to bring the recruiter's own text back; nothing is saved until they save the form.
 */
export default function CompanyAiDraft({ values, onChange }) {
  const { t } = useTranslation('company')
  const { data: config } = useGetConfigQuery()
  const [notes, setNotes] = useState('')
  const [previous, setPrevious] = useState(null)
  const [draft, state] = useDraftCompanyDescriptionMutation()
  const ready = values.displayName.trim().length >= (config?.limits.company.name.min ?? 2)

  async function handleDraft() {
    try {
      const { description } = await draft({
        name: values.displayName.trim(),
        industry: values.industry.trim(),
        size: values.size || null,
        city: values.place?.city ?? '',
        notes: notes.trim(),
      }).unwrap()
      // Undo always returns to the recruiter's own text, also after several AI drafts in a row.
      setPrevious((kept) => kept ?? values.description)
      onChange(description)
    } catch {
      // AiStatus shows the failure.
    }
  }

  function undo() {
    onChange(previous)
    setPrevious(null)
  }

  return (
    <div className={styles.draft} data-company-ai-draft>
      <div className={styles.row}>
        <TextField
          className={styles.notes}
          label={t('aiDraft.notes')}
          placeholder={t('aiDraft.notesPlaceholder')}
          maxLength={config?.limits.ai?.notes?.max}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <AiButton variant="outline" leftIcon={<Icon as={Sparkles} size={14} />} loading={state.isLoading} disabled={!ready} onClick={handleDraft} data-company-ai-draft-button>
          {t('aiDraft.action')}
        </AiButton>
      </div>
      <AiStatus isLoading={false} error={state.error} onRetry={handleDraft}>
        {previous !== null && (
          <p className={styles.done} role="status">
            {t('aiDraft.done')}
            <Button variant="ghost" size="sm" leftIcon={<Icon as={Undo2} size={13} />} onClick={undo}>
              {t('aiDraft.undo')}
            </Button>
          </p>
        )}
      </AiStatus>
    </div>
  )
}
