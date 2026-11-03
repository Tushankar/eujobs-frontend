import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { usePreferences } from '@/lib/preferences.js'
import { languageName } from '@/i18n/index.js'
import { useTranslateMutation } from '../api.js'
import AiButton from './AiButton.jsx'
import AiStatus from './AiStatus.jsx'
import styles from './Translatable.module.css'

/**
 * Translate on demand (M-144): `source` names the text on the server ({ entity, id, field, entryId }); `children(texts)`
 * renders the original `texts` or their translation into the reader's language, with "Show original" to go back.
 */
export default function Translatable({ source, texts, children }) {
  const { t } = useTranslation('ai')
  const { language } = usePreferences()
  const [translate, state] = useTranslateMutation()
  const [showTranslation, setShowTranslation] = useState(false)
  const translated = showTranslation && state.data?.texts

  async function handleTranslate() {
    if (state.data) return setShowTranslation(true)
    try {
      await translate(source).unwrap()
      setShowTranslation(true)
    } catch {
      // AiStatus shows the failure with Try again.
    }
  }

  return (
    <div className={styles.root} data-translatable={source.field}>
      {children(translated || texts)}
      <div className={styles.controls}>
        {translated ? (
          <>
            <span className={styles.note}>{t('translate.done', { language: languageName(language) })}</span>
            <button type="button" className={styles.link} onClick={() => setShowTranslation(false)}>
              {t('translate.original')}
            </button>
          </>
        ) : (
          !state.isError && (
            <AiButton variant="ghost" size="sm" className={styles.action} leftIcon={<Languages size={13} aria-hidden="true" />} loading={state.isLoading} onClick={handleTranslate}>
              {t('translate.action')}
            </AiButton>
          )
        )}
      </div>
      {state.isError && <AiStatus error={state.error} onRetry={() => state.reset()} />}
    </div>
  )
}
