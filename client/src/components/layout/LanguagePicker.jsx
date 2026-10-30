import { useTranslation } from 'react-i18next'
import { LANGUAGES, languageName } from '@/i18n/index.js'
import { usePreferences } from '@/lib/preferences.js'
import styles from './LanguagePicker.module.css'

/** M-140: the small language picker of the public pages (anonymous choices stay in this browser). */
export default function LanguagePicker() {
  const { t } = useTranslation()
  const { language, setLanguage } = usePreferences()
  return (
    <label className={styles.language}>
      <span className="sr-only">{t('shell:language.label')}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value)}>
        {LANGUAGES.map((code) => (
          <option key={code} value={code} lang={code}>
            {languageName(code)}
          </option>
        ))}
      </select>
    </label>
  )
}
